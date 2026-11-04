<?php

namespace Tests\Feature\Commerce;

use App\Mail\Commerce\OrderDelivered;
use App\Mail\Commerce\OrderShipped;
use App\Models\DeliveryTerm;
use App\Models\Order;
use App\Models\UserNotification;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Cara serah terima di quote + checkout (kontrak bagian 9, ASUMSI A-85): Loco tanpa alamat dan ongkir, Franco tetap
// wajib alamat + tarif, term nonaktif/beda pasar/penawaran ditolak, status Loco "siap diambil"/"sudah diambil".
class DeliveryTermCheckoutTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // Tanpa override fixture: baris bawaan migrasi (Loco aktif urutan 1, Franco nonaktif) membuat quote/checkout tanpa
    // deliveryTermCode menjadi ambil di pabrik, juga bila FE lama masih mengirim alamat + tarif.
    public function test_default_rows_make_quote_and_checkout_without_code_a_pickup(): void
    {
        $this->setUpCommerce();
        $this->useDefaultDeliveryTerms();
        $product = $this->makeProduct(['price' => 100000], 10);

        $this->getJson('/api/v1/commerce/config')->assertOk()->assertJsonCount(1, 'data.deliveryTerms')->assertJsonPath('data.deliveryTerms.0.code', 'loco');

        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]]])
            ->assertOk()->assertJsonPath('data.deliveryTerm.code', 'loco')->assertJsonPath('data.shipping.type', 'pickup')->assertJsonPath('data.shippingTotal', 0);
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => $product->slug, 'qty' => 1]], 'addressId' => $this->buyerAddress->id, 'shippingRateId' => $this->rate->id,
        ])->assertOk()->assertJsonPath('data.deliveryTerm.code', 'loco')->assertJsonPath('data.shipping.type', 'pickup')->assertJsonPath('data.availableShippingRates', []);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1, ['addressId' => null, 'shippingRateId' => null]))
            ->assertStatus(201)->assertJsonPath('data.deliveryTerm.code', 'loco')->assertJsonPath('data.shippingMethod.type', 'pickup')->assertJsonPath('data.shippingTotal', 0);

        // Franco nonaktif: kode eksplisit ditolak sampai admin mengaktifkannya.
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]], 'deliveryTermCode' => 'franco'])
            ->assertStatus(422)->assertJsonValidationErrors(['deliveryTermCode']);
    }

    public function test_quote_loco_without_address_has_zero_pickup_shipping_and_no_warnings(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct(['price' => 100000, 'weight_gram' => 2000], 50);
        $this->makeFee(5000);

        $response = $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => $product->slug, 'qty' => 3]],
            'deliveryTermCode' => 'loco',
            'shippingRateId' => $this->rate->id, // diabaikan tanpa warning untuk term tanpa ongkir
        ])->assertOk();

        $response->assertJsonPath('data.deliveryTerm.code', 'loco')
            ->assertJsonPath('data.deliveryTerm.family', 'pickup')
            ->assertJsonPath('data.deliveryTerm.pricingMode', 'none')
            ->assertJsonPath('data.deliveryTerm.name.en', 'Loco (pickup at factory)')
            ->assertJsonPath('data.shipping.type', 'pickup')
            ->assertJsonPath('data.shipping.rateId', null)
            ->assertJsonPath('data.shipping.zoneId', null)
            ->assertJsonPath('data.shipping.amount', 0)
            ->assertJsonPath('data.shipping.available', true)
            ->assertJsonPath('data.shipping.label.id', 'Loco (ambil di pabrik)')
            ->assertJsonPath('data.shipping.weightGram', 6000)
            ->assertJsonPath('data.availableShippingRates', [])
            ->assertJsonPath('data.shippingTotal', 0)
            ->assertJsonPath('data.feeTotal', 5000)
            ->assertJsonPath('data.grandTotal', 305000)
            ->assertJsonPath('data.warnings', []);

        // Dengan alamat pun Loco tidak menawarkan tarif zona.
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => $product->slug, 'qty' => 1]], 'deliveryTermCode' => 'loco', 'addressId' => $this->buyerAddress->id,
        ])->assertOk()->assertJsonPath('data.shipping.type', 'pickup')->assertJsonPath('data.availableShippingRates', []);
    }

    public function test_quote_without_code_uses_first_active_local_term_and_franco_keeps_zone_path(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 50);

        // Franco (sort 1) = bawaan: tanpa alamat shipping null, dengan alamat tarif zona seperti sebelumnya.
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]]])
            ->assertOk()->assertJsonPath('data.deliveryTerm.code', 'franco')->assertJsonPath('data.shipping', null)->assertJsonPath('data.availableShippingRates', []);
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => $product->slug, 'qty' => 1]], 'addressId' => $this->buyerAddress->id, 'shippingRateId' => $this->rate->id,
        ])->assertOk()->assertJsonPath('data.deliveryTerm.code', 'franco')->assertJsonPath('data.shipping.rateId', $this->rate->id)->assertJsonPath('data.shipping.type', 'calculated'); // tarif fixture per_kg = calculated

        // Admin menaikkan Loco ke urutan pertama: bawaan berubah tanpa mengubah FE.
        DeliveryTerm::where('code', 'loco')->update(['sort_order' => 0]);
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]]])
            ->assertOk()->assertJsonPath('data.deliveryTerm.code', 'loco')->assertJsonPath('data.shipping.type', 'pickup');
    }

    public function test_quote_rejects_inactive_export_and_unknown_terms_and_quoted_term_gives_pending_freight(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 50);
        $this->makeDeliveryTerm(['code' => 'fob', 'family' => 'port', 'market' => 'export', 'pricing_mode' => 'included', 'loading_port' => 'Belawan']);
        $this->makeDeliveryTerm(['code' => 'cif-lokal', 'family' => 'port', 'market' => 'local', 'pricing_mode' => 'quoted']);
        DeliveryTerm::where('code', 'loco')->update(['is_active' => false]);
        $body = fn (string $code) => ['items' => [['productSlug' => $product->slug, 'qty' => 1]], 'deliveryTermCode' => $code];

        foreach (['loco', 'fob', 'tidak-ada'] as $code) {
            $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', $body($code))
                ->assertStatus(422)->assertJsonPath('code', 'VALIDATION_ERROR')->assertJsonValidationErrors(['deliveryTermCode']);
        }

        // Term penawaran (pricing_mode quoted, Phase E5 / ASUMSI A-89): tidak lagi 422; ongkir 0 sementara + warning.
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', $body('cif-lokal'))
            ->assertOk()
            ->assertJsonPath('data.deliveryTerm.pricingMode', 'quoted')
            ->assertJsonPath('data.shipping.type', 'quoted')
            ->assertJsonPath('data.shipping.amount', 0)
            ->assertJsonPath('data.shippingTotal', 0)
            ->assertJsonPath('data.warnings', ['freight_quote_pending']);

        // Tidak ada term lokal aktif sama sekali → 422 juga tanpa kode.
        DeliveryTerm::where('market', 'local')->update(['is_active' => false]);
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]]])
            ->assertStatus(422)->assertJsonValidationErrors(['deliveryTermCode']);
    }

    public function test_checkout_loco_creates_pickup_order_without_address_and_shipping_cost(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct(['slug' => 'sarung-egrek', 'price' => 50000], 100);
        $this->makeFee(5000);

        $response = $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 20, [
            'deliveryTermCode' => 'loco', 'addressId' => null, 'shippingRateId' => null,
        ]))->assertStatus(201);
        $code = $response->json('data.uniqueCode');

        $response->assertJsonPath('data.status', 'pending_payment')
            ->assertJsonPath('data.deliveryTerm.code', 'loco')
            ->assertJsonPath('data.deliveryTerm.family', 'pickup')
            ->assertJsonPath('data.deliveryTerm.pricingMode', 'none')
            ->assertJsonPath('data.deliveryTerm.name.id', 'Loco (ambil di pabrik)')
            ->assertJsonPath('data.shippingMethod.type', 'pickup')
            ->assertJsonPath('data.shippingMethod.rateId', null)
            ->assertJsonPath('data.shippingMethod.amount', 0)
            ->assertJsonPath('data.shippingTotal', 0)
            ->assertJsonPath('data.shippingAddress.type', 'pickup')
            ->assertJsonPath('data.shippingAddress.label', 'Pabrik Tanjung Morawa')
            ->assertJsonPath('data.shippingAddress.lat', 3.5387)
            ->assertJsonPath('data.shippingAddress.recipientName', 'Coating Solutions Co.')
            ->assertJsonPath('data.shippingAddress.phone', '081234567890')
            ->assertJsonPath('data.pickup.label', 'Pabrik Tanjung Morawa')
            ->assertJsonPath('data.pickup.lng', 98.7467)
            ->assertJsonPath('data.subtotal', 1000000)
            ->assertJsonPath('data.feeTotal', 5000)
            ->assertJsonPath('data.grandTotal', 1005000 + $code)
            ->assertJsonPath('data.canAddTracking', false);
        $this->assertStringContainsString('Tanjung Morawa', $response->json('data.shippingAddress.address'));

        $order = Order::where('number', $response->json('data.number'))->firstOrFail();
        $this->assertSame('loco', $order->delivery_term);
        $this->assertSame('loco', $order->shipping_snapshot['term']);
        $this->assertSame('pickup', $order->shipping_snapshot['family']);
        $this->assertSame('none', $order->shipping_snapshot['pricingMode']);
        $this->assertTrue($order->isPickup());
        $this->assertSame(20, $product->fresh()->reserved_qty);

        // Daftar: ringkasan membawa kode + keluarga untuk label FE.
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders')->assertOk()
            ->assertJsonPath('data.0.deliveryTerm.code', 'loco')->assertJsonPath('data.0.deliveryTerm.family', 'pickup');

        // Loco dengan alamat + tarif terkirim (FE lama atau pengguna yang sudah memilih alamat): tetap ambil di pabrik,
        // ongkir 0, dan total sama dengan quote + kode unik.
        $quote = $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => $product->slug, 'qty' => 2]], 'deliveryTermCode' => 'loco',
            'addressId' => $this->buyerAddress->id, 'shippingRateId' => $this->rate->id,
        ])->assertOk()->assertJsonPath('data.shipping.type', 'pickup')->assertJsonPath('data.shippingTotal', 0)->json('data');
        $withAddress = $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 2, ['deliveryTermCode' => 'loco']))
            ->assertStatus(201)
            ->assertJsonPath('data.deliveryTerm.code', 'loco')
            ->assertJsonPath('data.shippingMethod.type', 'pickup')
            ->assertJsonPath('data.shippingMethod.rateId', null)
            ->assertJsonPath('data.shippingTotal', 0)
            ->assertJsonPath('data.shippingAddress.type', 'pickup')
            ->assertJsonPath('data.subtotal', $quote['subtotal'])
            ->assertJsonPath('data.feeTotal', $quote['feeTotal']);
        $this->assertSame($quote['grandTotal'] + $withAddress->json('data.uniqueCode'), $withAddress->json('data.grandTotal'));
        $withAddressOrder = Order::where('number', $withAddress->json('data.number'))->firstOrFail();
        $this->assertSame('pickup', $withAddressOrder->shipping_snapshot['type']);
        $this->assertSame(0, (int) $withAddressOrder->shipping_total);
        $this->assertNull($withAddressOrder->shipping_snapshot['rateId'] ?? null);

        // Order Franco tetap menyimpan kode dan snapshot alamat customer.
        $franco = $this->placeOrder($product, 1);
        $this->assertSame('franco', $franco->delivery_term);
        $this->assertSame('door', $franco->shipping_snapshot['family']);
        $this->assertFalse($franco->isPickup());
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$franco->number)->assertOk()
            ->assertJsonPath('data.deliveryTerm.code', 'franco')->assertJsonPath('data.pickup', null)->assertJsonPath('data.shippingAddress.recipientName', 'Budi Santoso / Gudang');
    }

    public function test_checkout_franco_still_requires_address_and_rate_and_rejects_bad_terms(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $base = ['items' => [['productSlug' => $product->slug, 'qty' => 1]], 'paymentMethodCode' => $this->manualTransfer->code];

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $base + ['deliveryTermCode' => 'franco'])
            ->assertStatus(422)->assertJsonValidationErrors(['addressId', 'shippingRateId']);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $base)
            ->assertStatus(422)->assertJsonValidationErrors(['addressId', 'shippingRateId']); // bawaan = franco

        DeliveryTerm::where('code', 'loco')->update(['is_active' => false]);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $base + ['deliveryTermCode' => 'loco'])
            ->assertStatus(422)->assertJsonValidationErrors(['deliveryTermCode']);
        $this->makeDeliveryTerm(['code' => 'fob', 'family' => 'port', 'market' => 'export', 'pricing_mode' => 'included']);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $base + ['deliveryTermCode' => 'fob'])
            ->assertStatus(422)->assertJsonValidationErrors(['deliveryTermCode']);

        $this->assertSame(0, Order::count());
        $this->assertSame(0, $product->fresh()->reserved_qty);
    }

    public function test_pickup_order_is_marked_ready_and_picked_up_without_courier(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct(['name' => ['id' => 'Sarung Egrek', 'en' => 'Sickle Cover']], 10);
        $order = $this->payOrder($this->placeOrder($product, 2, ['deliveryTermCode' => 'loco', 'addressId' => null, 'shippingRateId' => null]));
        $admin = $this->adminWith(['orders']);
        $url = '/api/v1/admin/orders/'.$order->number;

        $this->actingAs($admin)->postJson($url.'/status', ['status' => 'processing'])->assertOk();
        $this->actingAs($admin)->postJson($url.'/status', ['status' => 'shipped'])
            ->assertOk()
            ->assertJsonPath('data.status', 'shipped')
            ->assertJsonPath('data.courier', null)
            ->assertJsonPath('data.trackingNumber', null)
            ->assertJsonPath('data.timeline.4.note', 'Pesanan siap diambil di Pabrik Tanjung Morawa.')
            ->assertJsonPath('data.timeline.4.meta', null)
            ->assertJsonPath('data.canAddTracking', false)
            ->assertJsonPath('data.canConfirmReceived', true);
        $this->actingAs($admin)->postJson($url.'/tracking', ['note' => 'Sudah di gudang'])->assertStatus(409)->assertJsonPath('code', 'TRACKING_NOT_ALLOWED');

        $ready = UserNotification::where('user_id', $this->buyer->id)->where('type', 'order.ready_for_pickup')->first();
        $this->assertNotNull($ready);
        $this->assertStringContainsString('Pabrik Tanjung Morawa', $ready->body['id']);
        $this->assertSame(0, UserNotification::where('type', 'order.shipped')->count());
        Mail::assertQueued(OrderShipped::class, fn (OrderShipped $mail) => $mail->hasTo('buyer@coatingsolutions.co.id'));

        // Customer mengonfirmasi sudah mengambil barang.
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/confirm-received')
            ->assertOk()->assertJsonPath('data.status', 'delivered')->assertJsonPath('data.timeline.5.note', 'Pesanan sudah diambil.');
        $this->assertSame(1, UserNotification::where('type', 'order.picked_up')->count());
        Mail::assertQueued(OrderDelivered::class);

        // Order Franco tetap wajib kurir + resi.
        $franco = $this->payOrder($this->placeOrder($product, 1));
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$franco->number.'/status', ['status' => 'processing'])->assertOk();
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$franco->number.'/status', ['status' => 'shipped'])
            ->assertStatus(422)->assertJsonValidationErrors(['courier', 'trackingNumber']);

        // Label titik ambil kosong (snapshot lama sebelum A-90, tanpa points[] dan tanpa nama pabrik): kalimat histori dan
        // notifikasi tetap utuh ("di pabrik", bukan "di .").
        $blank = $this->payOrder($this->placeOrder($product, 1, ['deliveryTermCode' => 'loco', 'addressId' => null, 'shippingRateId' => null]));
        $legacy = $blank->shipping_address_snapshot;
        unset($legacy['points']);
        $blank->forceFill(['shipping_address_snapshot' => ['label' => ''] + $legacy])->save();
        $blank->refresh();
        $this->assertSame('', (string) $blank->pickupPoint()['label']);
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$blank->number.'/status', ['status' => 'processing'])->assertOk();
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$blank->number.'/status', ['status' => 'shipped'])
            ->assertOk()->assertJsonPath('data.timeline.4.note', 'Pesanan siap diambil di pabrik.');
        $this->assertSame(
            'Pesanan '.$blank->number.' siap diambil di pabrik.',
            UserNotification::where('type', 'order.ready_for_pickup')->latest('id')->first()->body['id']
        );
        $this->assertSame('the factory', $blank->fresh()->pickupLabel('en'));
    }

    // Loco yang sudah diambil (delivered) ikut diselesaikan orders:auto-complete seperti order zona.
    public function test_pickup_order_is_auto_completed_like_a_zone_order(): void
    {
        Mail::fake();
        $this->setUpCommerce(['autoCompleteDays' => 7]);
        $product = $this->makeProduct([], 10);
        $admin = $this->superAdmin();
        $sm = app(OrderStateMachine::class);

        $pickup = $this->payOrder($this->placeOrder($product, 1, ['deliveryTermCode' => 'loco', 'addressId' => null, 'shippingRateId' => null]));
        $sm->transition($pickup, Order::STATUS_PROCESSING, $admin);
        $sm->transition($pickup, Order::STATUS_SHIPPED, $admin);
        $sm->transition($pickup, Order::STATUS_DELIVERED, $this->buyer);

        $zone = $this->payOrder($this->placeOrder($product, 1));
        $sm->transition($zone, Order::STATUS_PROCESSING, $admin);
        $sm->transition($zone, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'A']);
        $sm->transition($zone, Order::STATUS_DELIVERED, $admin);

        Carbon::setTestNow(now()->addDays(6));
        $this->artisan('orders:auto-complete')->expectsOutput('0 order(s) auto-completed.')->assertExitCode(0);
        $this->assertSame('delivered', $pickup->fresh()->status);

        Carbon::setTestNow(now()->addDays(2));
        $this->artisan('orders:auto-complete')->expectsOutput('2 order(s) auto-completed.')->assertExitCode(0);
        $this->artisan('orders:auto-complete')->expectsOutput('0 order(s) auto-completed.')->assertExitCode(0);

        $pickup->refresh();
        $this->assertSame('completed', $pickup->status);
        $this->assertNotNull($pickup->completed_at);
        $this->assertTrue($pickup->isPickup());
        $this->assertSame('completed', $zone->fresh()->status);
        $this->assertDatabaseHas('order_status_histories', ['order_id' => $pickup->id, 'to_status' => 'completed', 'actor_type' => 'system']);
    }

    // Render nyata (tanpa Mail::fake, seperti OrderMailTest): email Loco memuat titik ambil, bukan kurir/resi, dalam dua bahasa.
    public function test_pickup_mails_show_pickup_point_instead_of_courier(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $admin = $this->adminWith(['orders']);
        $order = $this->payOrder($this->placeOrder($product, 2, ['deliveryTermCode' => 'loco', 'addressId' => null, 'shippingRateId' => null]), $admin);
        $sm = app(OrderStateMachine::class);
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin);
        $order->refresh();

        $html = (new OrderShipped($order))->render();
        $this->assertStringContainsString('siap diambil', $html);
        $this->assertStringContainsString('Pabrik Tanjung Morawa', $html);
        $this->assertStringContainsString('Tanjung Morawa Km', $html);
        $this->assertStringNotContainsString('Nomor resi', $html);

        $sm->transition($order, Order::STATUS_DELIVERED, $this->buyer);
        $order->refresh();
        $this->assertStringContainsString('sudah diambil', (new OrderDelivered($order, 7))->render());

        $order->forceFill(['locale' => 'en'])->save();
        $order->refresh();
        $en = (new OrderShipped($order))->render();
        $this->assertStringContainsString('ready to be collected', $en);
        $this->assertStringContainsString('Pickup point', $en);
        $this->assertStringNotContainsString('Tracking number', $en);
        $this->assertStringContainsString('recorded as picked up', (new OrderDelivered($order, 7))->render());
    }
}
