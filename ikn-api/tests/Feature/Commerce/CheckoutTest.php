<?php

namespace Tests\Feature\Commerce;

use App\Mail\Commerce\OrderPlaced;
use App\Mail\Commerce\OrderPlacedAdmin;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\VoucherUsage;
use App\Services\Stock\StockLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// POST /customer/orders (kontrak bagian 9, arsitektur bagian 8): snapshot, reserve stok, kode unik, idempotensi.
class CheckoutTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_checkout_creates_order_with_snapshots_reservation_payment_and_emails(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $this->adminWith(['orders'], ['email' => 'order-admin@ptikn.com']);
        $this->adminWith(['news'], ['email' => 'news-admin@ptikn.com']);
        $product = $this->makeProduct(['slug' => 'resiprene-35', 'code' => 'RSP-35', 'price' => 185000, 'moq' => 25, 'weight_gram' => 1000, 'unit' => 'kg'], 1200);
        $this->makeVoucher(['code' => 'IKN10', 'value' => 10, 'min_subtotal' => 5000000, 'max_discount' => 2000000, 'quota' => 100]);
        $this->makeFee(5000);

        $response = $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 100, ['voucherCode' => 'ikn10', 'note' => 'Kirim jam kerja']))
            ->assertStatus(201);

        $number = $response->json('data.number');
        $this->assertMatchesRegularExpression('/^IKN-\d{8}-00001$/', $number);
        $code = $response->json('data.uniqueCode');
        $this->assertGreaterThanOrEqual(1, $code);
        $this->assertLessThanOrEqual(999, $code);

        // 100 kg × 185.000 = 18.500.000 − 10% (1.850.000) + ongkir (50.000 + 3.500 × 100 kg = 400.000) + fee 5.000 + kode unik.
        $response->assertJsonPath('data.status', 'pending_payment')
            ->assertJsonPath('data.paymentStatus', 'pending')
            ->assertJsonPath('data.customer.name', 'Coating Solutions Co.')
            ->assertJsonPath('data.customer.pic', 'Budi Santoso')
            ->assertJsonPath('data.items.0.productSlug', 'resiprene-35')
            ->assertJsonPath('data.items.0.code', 'RSP-35')
            ->assertJsonPath('data.items.0.qty', 100)
            ->assertJsonPath('data.items.0.unitPrice', 185000)
            ->assertJsonPath('data.items.0.discountAmount', 1850000)
            ->assertJsonPath('data.items.0.lineTotal', 18500000)
            ->assertJsonPath('data.subtotal', 18500000)
            ->assertJsonPath('data.discountTotal', 1850000)
            ->assertJsonPath('data.shippingTotal', 400000)
            ->assertJsonPath('data.feeTotal', 5000)
            ->assertJsonPath('data.taxTotal', 1650000)
            ->assertJsonPath('data.grandTotal', 17055000 + $code)
            ->assertJsonPath('data.voucherCode', 'IKN10')
            ->assertJsonPath('data.note', 'Kirim jam kerja')
            ->assertJsonPath('data.shippingMethod.rateId', $this->rate->id)
            ->assertJsonPath('data.shippingAddress.region.village', 'Cakung Barat')
            ->assertJsonPath('data.shippingAddress.recipientName', 'Budi Santoso / Gudang')
            ->assertJsonPath('data.payment.method', 'manual_transfer')
            ->assertJsonPath('data.payment.status', 'pending')
            ->assertJsonPath('data.payment.amount', 17055000 + $code)
            ->assertJsonPath('data.payment.bankAccount.accountNumber', '0123456789')
            ->assertJsonPath('data.payment.instructions.id', 'Transfer ke rekening di bawah.')
            ->assertJsonPath('data.activePayment.id', $response->json('data.payment.id'))
            ->assertJsonPath('data.timeline.0.status', 'pending_payment')
            ->assertJsonPath('data.timeline.0.fromStatus', null)
            ->assertJsonPath('data.canCancel', true)
            ->assertJsonPath('data.canUploadProof', true)
            ->assertJsonPath('data.canReview', false)
            ->assertJsonCount(1, 'data.payments')
            ->assertJsonCount(1, 'data.timeline');
        $this->assertNotNull($response->json('data.paymentDueAt'));
        $this->assertStringContainsString('+07:00', $response->json('data.paymentDueAt'));

        $order = Order::where('number', $number)->first();
        $this->assertSame($this->buyer->id, $order->user_id);
        $this->assertTrue($order->payment_due_at->between(now()->addHours(23), now()->addHours(25)));

        // Stok ter-reserve, ledger konsisten, voucher reserved.
        $product->refresh();
        $this->assertSame(1200, $product->stock_qty);
        $this->assertSame(100, $product->reserved_qty);
        $this->assertSame(1100, $product->available);
        $this->assertDatabaseHas('stock_movements', ['idempotency_key' => "order:{$order->id}:reserve:{$product->id}", 'qty' => 100]);
        $this->assertDatabaseHas('voucher_usages', ['order_id' => $order->id, 'status' => VoucherUsage::STATUS_RESERVED]);
        $this->assertSame(1, \App\Models\Voucher::where('code', 'IKN10')->value('used_count'));
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'status' => Payment::STATUS_PENDING, 'provider' => 'manual', 'external_id' => $number.'-'.$response->json('data.payment.id')]);

        // stock:rebuild tidak mengubah angka.
        app(StockLedger::class)->rebuild();
        $product->refresh();
        $this->assertSame([1200, 100], [$product->stock_qty, $product->reserved_qty]);

        // Email: customer + admin bermodul orders (bukan admin news).
        Mail::assertQueued(OrderPlaced::class, fn (OrderPlaced $mail) => $mail->hasTo('buyer@coatingsolutions.co.id') && $mail->locale === 'id');
        Mail::assertQueued(OrderPlacedAdmin::class, fn (OrderPlacedAdmin $mail) => $mail->hasTo('order-admin@ptikn.com'));
        Mail::assertNotQueued(OrderPlacedAdmin::class, fn (OrderPlacedAdmin $mail) => $mail->hasTo('news-admin@ptikn.com'));
    }

    public function test_checkout_requires_approved_customer_and_valid_body(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $pending = $this->customer(['status' => User::STATUS_PENDING]);

        $this->actingAs($pending)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product))
            ->assertStatus(403)->assertJsonPath('code', 'ACCOUNT_NOT_APPROVED')->assertJsonPath('meta.status', 'pending');

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', ['items' => []])
            ->assertStatus(422)->assertJsonValidationErrors(['items', 'addressId', 'shippingRateId', 'paymentMethodCode']);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1, ['paymentMethodCode' => 'qris_dynamic']))
            ->assertStatus(422)->assertJsonValidationErrors(['paymentMethodCode']);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1, ['bankAccountId' => 999]))
            ->assertStatus(422)->assertJsonValidationErrors(['bankAccountId']);

        $this->assertSame(0, Order::count());
        $this->assertSame(0, StockMovement::where('type', StockMovement::TYPE_RESERVE)->count());
    }

    public function test_sequential_checkouts_on_single_stock_yield_201_then_409_and_lock_products_for_update(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct(['slug' => 'packing-pintu-rebusan'], 1);

        DB::enableQueryLog();
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1))->assertStatus(201);
        $queries = array_map(fn ($q) => strtolower($q['query']), DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertTrue(
            collect($queries)->contains(fn ($sql) => str_contains($sql, 'from "products"') && str_contains($sql, 'for update')),
            'checkout must lock product rows with SELECT ... FOR UPDATE'
        );

        $other = $this->customer(['email' => 'lain@example.com']);
        $other->addresses()->create($this->addressAttributes());
        $this->app['auth']->forgetGuards();
        $this->actingAs($other)->postJson('/api/v1/customer/orders', array_merge($this->checkoutPayload($product, 1), ['addressId' => $other->addresses()->first()->id]))
            ->assertStatus(409)
            ->assertJsonPath('code', 'INSUFFICIENT_STOCK')
            ->assertJsonPath('meta.items.0.productSlug', 'packing-pintu-rebusan')
            ->assertJsonPath('meta.items.0.requested', 1)
            ->assertJsonPath('meta.items.0.available', 0);

        $this->assertSame(1, Order::count());
        $product->refresh();
        $this->assertSame([1, 1, 0], [$product->stock_qty, $product->reserved_qty, $product->available]);
        $this->assertSame(1, StockMovement::where('type', StockMovement::TYPE_RESERVE)->count());
    }

    public function test_same_idempotency_key_returns_same_order_with_200(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $headers = ['Idempotency-Key' => '4d0e7a1c-1111-4c3b-9a1b-000000000001'];

        $first = $this->actingAs($this->buyer)->withHeaders($headers)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 2))->assertStatus(201);
        $second = $this->actingAs($this->buyer)->withHeaders($headers)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 2))->assertStatus(200);

        $this->assertSame($first->json('data.number'), $second->json('data.number'));
        $this->assertSame(1, Order::count());
        $this->assertSame(2, $product->fresh()->reserved_qty);

        // Kunci yang sama dari user lain tidak berbagi order.
        $other = $this->customer(['email' => 'lain@example.com']);
        $other->addresses()->create($this->addressAttributes());
        $this->app['auth']->forgetGuards();
        $this->actingAs($other)->withHeaders($headers)->postJson('/api/v1/customer/orders', array_merge($this->checkoutPayload($product, 1), ['addressId' => $other->addresses()->first()->id]))
            ->assertStatus(201);
        $this->assertSame(2, Order::count());

        // Tanpa kunci: order baru.
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1))->assertStatus(201);
        $this->assertSame(3, Order::count());
    }

    public function test_price_snapshot_does_not_change_when_product_is_edited(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct(['slug' => 'sepatu-boots', 'price' => 170000], 50);
        $order = $this->placeOrder($product, 2);

        $product->update(['price' => 999999, 'name' => ['id' => 'Nama Baru'], 'slug' => 'slug-baru']);

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$order->number)
            ->assertOk()
            ->assertJsonPath('data.items.0.unitPrice', 170000)
            ->assertJsonPath('data.items.0.lineTotal', 340000)
            ->assertJsonPath('data.items.0.productSlug', 'sepatu-boots')
            ->assertJsonPath('data.items.0.name.id', 'Sepatu boots')
            ->assertJsonPath('data.subtotal', 340000);
    }

    public function test_unique_code_is_unique_among_pending_orders_of_the_day_and_absent_for_qris(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 100);
        $qris = $this->makePaymentMethod('qris_static');

        $codes = [];
        for ($i = 0; $i < 5; $i++) {
            $codes[] = $this->placeOrder($product, 1)->unique_code;
        }
        $this->assertCount(5, array_unique($codes));
        foreach ($codes as $code) {
            $this->assertGreaterThanOrEqual(1, $code);
        }

        $qrisOrder = $this->placeOrder($product, 1, ['paymentMethodCode' => $qris->code]);
        $this->assertSame(0, $qrisOrder->unique_code);
        $this->assertNull($qrisOrder->payments()->first()->bank_account_id);

        $this->commerceSettings(['uniqueCodeEnabled' => false]);
        $this->assertSame(0, $this->placeOrder($product, 1)->unique_code);
    }

    public function test_grand_total_matches_cart_quote_before_unique_code(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct(['price' => 185000, 'moq' => 25], 1200);
        $this->makeFee(5000);
        $payload = $this->checkoutPayload($product, 100);

        $quote = $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', $payload)->assertOk();
        $order = $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $payload)->assertStatus(201);

        $this->assertSame(
            $quote->json('data.grandTotal') - $quote->json('data.uniqueCode'),
            $order->json('data.grandTotal') - $order->json('data.uniqueCode')
        );
        $this->assertSame($quote->json('data.shippingTotal'), $order->json('data.shippingTotal'));
        $this->assertSame($quote->json('data.taxTotal'), $order->json('data.taxTotal'));
    }
}
