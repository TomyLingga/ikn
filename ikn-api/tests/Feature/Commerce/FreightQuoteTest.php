<?php

namespace Tests\Feature\Commerce;

use App\Mail\Commerce\FreightAccepted;
use App\Mail\Commerce\FreightAcceptedAdmin;
use App\Mail\Commerce\FreightCounteredAdmin;
use App\Mail\Commerce\FreightQuoted;
use App\Mail\Commerce\FreightQuoteExpiredAdmin;
use App\Mail\Commerce\FreightRequested;
use App\Mail\Commerce\FreightRequestedAdmin;
use App\Mail\Commerce\OrderCancelled;
use App\Models\BankAccount;
use App\Models\DeliveryTerm;
use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\Commerce\CheckoutService;
use App\Services\Payment\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

/**
 * CIF: pelabuhan tujuan + penawaran ongkir (kontrak 9, 11.2, 11.12; ASUMSI A-89). Checkout CIF → awaiting_freight tanpa
 * payment; admin menawar per baris; customer menerima/membalas/membatalkan; accept membuat payment + batas bayar dan
 * memindahkan order ke pending_payment; kedaluwarsa dan batas tunggu lewat orders:freight-expire.
 */
class FreightQuoteTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    private const PORT = ['name' => 'Port Klang', 'country' => 'Malaysia', 'countryCode' => 'my', 'lat' => 2.9997, 'lng' => 101.3929];

    private const LINES = [
        ['label' => 'Ocean freight Belawan - Port Klang', 'amount' => 65000],
        ['label' => 'Port charges', 'amount' => 12000],
        ['label' => 'Insurance', 'amount' => 4500],
    ];

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function setUpCif(): Product
    {
        $this->setUpCommerce(['exportPaymentDueHours' => 120, 'paymentDueHours' => 24]);
        $this->setUpExport();
        $this->makeFee(2500, true, 'USD'); // USD 25,00

        return $this->makeProduct(['slug' => 'resiprene-35', 'code' => 'RSP-35', 'price' => 185000, 'price_usd' => '12.50', 'moq' => 25, 'unit' => 'kg'], 1000);
    }

    private function cifPayload(Product $product, int $qty = 100, array $overrides = []): array
    {
        return $this->exportCheckoutPayload($product, $qty, array_merge(['deliveryTermCode' => 'cif', 'destinationPort' => self::PORT], $overrides));
    }

    /** Order CIF awaiting_freight lewat service (100 kg × USD 12,50 + fee USD 25 = USD 1.275,00 tanpa ongkir). */
    private function cifOrder(Product $product, int $qty = 100): Order
    {
        return app(CheckoutService::class)->place($this->exporter, $this->cifPayload($product, $qty));
    }

    private function adminUrl(Order $order): string
    {
        return '/api/v1/admin/orders/'.$order->number.'/freight-quotes';
    }

    private function customerUrl(Order $order): string
    {
        return '/api/v1/customer/orders/'.$order->number.'/freight-quotes';
    }

    private function propose(Order $order, User $admin, array $lines = self::LINES, array $extra = []): OrderFreightQuote
    {
        $this->actingAs($admin)->postJson($this->adminUrl($order), ['lines' => $lines] + $extra)->assertStatus(201);
        $this->app['auth']->forgetGuards();

        return $order->fresh()->activeFreightQuote();
    }

    public function test_cif_checkout_creates_awaiting_freight_order_without_payment_and_requires_destination_port(): void
    {
        Mail::fake();
        $product = $this->setUpCif();
        $admin = $this->adminWith(['orders']);
        $noModule = $this->adminWith(['payments']);

        // Quote: term CIF tidak lagi 422; ongkir 0 sementara + warning.
        $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 100]], 'deliveryTermCode' => 'cif', 'paymentMethodCode' => 'manual_transfer'])
            ->assertOk()
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.deliveryTerm.code', 'cif')->assertJsonPath('data.deliveryTerm.pricingMode', 'quoted')->assertJsonPath('data.deliveryTerm.requiresDestinationPort', true)
            ->assertJsonPath('data.shipping.type', 'quoted')->assertJsonPath('data.shipping.amount', 0)->assertJsonPath('data.shipping.rateId', null)
            ->assertJsonPath('data.shippingTotal', 0)->assertJsonPath('data.feeTotal', 2500)->assertJsonPath('data.grandTotal', 127500)
            ->assertJsonPath('data.warnings', ['freight_quote_pending']);

        // Checkout tanpa pelabuhan tujuan → 422 (nama, negara, lat, lng wajib untuk term CIF); FOB tidak membutuhkannya.
        $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders', $this->cifPayload($product, 100, ['destinationPort' => null]))
            ->assertStatus(422)->assertJsonValidationErrors(['destinationPort']);
        $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders', $this->cifPayload($product, 100, ['destinationPort' => ['name' => 'Port Klang']]))
            ->assertStatus(422)->assertJsonValidationErrors(['destinationPort.country', 'destinationPort.lat', 'destinationPort.lng']);
        $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders', $this->cifPayload($product, 100, ['destinationPort' => array_merge(self::PORT, ['countryCode' => 'MYS'])]))
            ->assertStatus(422)->assertJsonValidationErrors(['destinationPort.countryCode']);
        $this->assertSame(0, Order::count());

        $response = $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders', $this->cifPayload($product, 100))->assertStatus(201);
        $response->assertJsonPath('data.status', 'awaiting_freight')
            ->assertJsonPath('data.paymentStatus', null)
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.paymentDueAt', null)
            ->assertJsonPath('data.uniqueCode', 0)
            ->assertJsonPath('data.subtotal', 125000)->assertJsonPath('data.feeTotal', 2500)->assertJsonPath('data.shippingTotal', 0)->assertJsonPath('data.grandTotal', 127500)
            ->assertJsonPath('data.deliveryTerm.code', 'cif')->assertJsonPath('data.deliveryTerm.family', 'port')->assertJsonPath('data.deliveryTerm.pricingMode', 'quoted')
            ->assertJsonPath('data.shippingMethod.type', 'quoted')->assertJsonPath('data.shippingMethod.amount', 0)->assertJsonPath('data.shippingMethod.lines', null)
            ->assertJsonPath('data.shippingAddress.type', 'port')->assertJsonPath('data.shippingAddress.loadingPort', 'Belawan')->assertJsonPath('data.shippingAddress.destinationPort.name', 'Port Klang')
            ->assertJsonPath('data.destinationPort.name', 'Port Klang')->assertJsonPath('data.destinationPort.country', 'Malaysia')
            ->assertJsonPath('data.destinationPort.countryCode', 'MY')->assertJsonPath('data.destinationPort.lat', 2.9997)->assertJsonPath('data.destinationPort.lng', 101.3929)
            ->assertJsonPath('data.isPort', true)
            ->assertJsonPath('data.payments', [])->assertJsonPath('data.activePayment', null)
            ->assertJsonPath('data.pendingPaymentMethod.code', 'manual_transfer')->assertJsonPath('data.pendingPaymentMethod.bankAccountId', $this->usdBank->id)
            ->assertJsonPath('data.freightQuotes', [])->assertJsonPath('data.activeFreightQuote', null)
            ->assertJsonPath('data.canAcceptFreightQuote', false)->assertJsonPath('data.canCounterFreightQuote', false)->assertJsonPath('data.canQuoteFreight', true)
            ->assertJsonPath('data.canCancel', true)->assertJsonPath('data.canUploadProof', false)->assertJsonPath('data.canChangePayment', false)
            ->assertJsonPath('data.timeline.0.status', 'awaiting_freight')->assertJsonPath('data.timeline.0.fromStatus', null);
        $this->assertStringContainsString('Port Klang', $response->json('data.timeline.0.note'));

        $order = Order::where('number', $response->json('data.number'))->firstOrFail();
        $this->assertSame('awaiting_freight', $order->status);
        $this->assertNull($order->payment_due_at);
        $this->assertSame(0, $order->payments()->count());
        $this->assertSame('Port Klang', $order->destination_port['name']);
        $this->assertSame(['code' => 'manual_transfer', 'bankAccountId' => $this->usdBank->id], $order->pending_payment_method);
        $this->assertSame(100, $product->fresh()->reserved_qty);

        // Notifikasi: customer in-app + email; admin modul orders email permintaan penawaran.
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.freight_requested')->count());
        Mail::assertQueued(FreightRequested::class, fn (FreightRequested $mail) => $mail->hasTo('buyer@rubbertrade.example'));
        Mail::assertQueued(FreightRequestedAdmin::class, fn (FreightRequestedAdmin $mail) => $mail->hasTo($admin->email));
        Mail::assertNotQueued(FreightRequestedAdmin::class, fn (FreightRequestedAdmin $mail) => $mail->hasTo($noModule->email));

        // Badge + antrean kerja admin memasukkan awaiting_freight; tab customer "unpaid" ikut menghitungnya.
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)->getJson('/api/v1/admin/badges')->assertOk()->assertJsonPath('data.orders', 1);
        $this->actingAs($this->superAdmin())->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.workQueue.freightToQuote', 1)->assertJsonPath('data.needsAction.0.number', $order->number);
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?status=awaiting_freight')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.counts.awaiting_freight', 1);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->getJson('/api/v1/customer/orders?group=unpaid')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.groups.unpaid', 1)->assertJsonPath('data.0.paymentMethod', 'manual_transfer')->assertJsonPath('data.0.destinationPort', 'Port Klang');

        // Bukti bayar / ganti metode belum bisa sebelum ongkir disepakati.
        $this->actingAs($this->exporter)->post('/api/v1/customer/orders/'.$order->number.'/proof', ['file' => $this->proofFile()], ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION');
    }

    public function test_admin_proposes_itemised_quote_with_validation_and_second_quote_supersedes_first(): void
    {
        Mail::fake();
        $product = $this->setUpCif();
        $order = $this->cifOrder($product);
        $admin = $this->adminWith(['orders'], ['name' => 'Admin Ekspor']);
        Carbon::setTestNow(Carbon::parse('2026-11-03 09:00:00', config('app.timezone')));

        // Validasi: baris kosong, total 0, label terlalu panjang, lebih dari 10 baris, masa berlaku di masa lalu.
        $this->actingAs($admin)->postJson($this->adminUrl($order), ['lines' => []])->assertStatus(422)->assertJsonValidationErrors(['lines']);
        $this->actingAs($admin)->postJson($this->adminUrl($order), ['lines' => [['label' => 'Ocean freight', 'amount' => 0]]])->assertStatus(422)->assertJsonValidationErrors(['lines']);
        $this->actingAs($admin)->postJson($this->adminUrl($order), ['lines' => [['label' => str_repeat('a', 81), 'amount' => 100]]])->assertStatus(422)->assertJsonValidationErrors(['lines.0.label']);
        $this->actingAs($admin)->postJson($this->adminUrl($order), ['lines' => array_fill(0, 11, ['label' => 'x', 'amount' => 1])])->assertStatus(422)->assertJsonValidationErrors(['lines']);
        $this->actingAs($admin)->postJson($this->adminUrl($order), ['lines' => self::LINES, 'validUntil' => '2026-11-01'])->assertStatus(422)->assertJsonValidationErrors(['validUntil']);
        $this->assertSame(0, OrderFreightQuote::count());

        // Putaran 1: masa berlaku bawaan = setting freightQuoteValidDays (7 hari).
        $first = $this->actingAs($admin)->postJson($this->adminUrl($order), ['lines' => self::LINES, 'note' => ' Rate valid for shipment within two weeks. '])->assertStatus(201);
        $first->assertJsonPath('data.status', 'awaiting_freight')
            ->assertJsonCount(1, 'data.freightQuotes')
            ->assertJsonPath('data.freightQuotes.0.round', 1)
            ->assertJsonPath('data.freightQuotes.0.proposedBy', 'admin')
            ->assertJsonPath('data.freightQuotes.0.lines', self::LINES)
            ->assertJsonPath('data.freightQuotes.0.total', 81500)
            ->assertJsonPath('data.freightQuotes.0.note', 'Rate valid for shipment within two weeks.')
            ->assertJsonPath('data.freightQuotes.0.status', 'proposed')
            ->assertJsonPath('data.freightQuotes.0.expired', false)
            ->assertJsonPath('data.freightQuotes.0.validUntil', '2026-11-10T09:00:00+07:00')
            ->assertJsonPath('data.freightQuotes.0.createdBy.name', 'Admin Ekspor')
            ->assertJsonPath('data.freightQuotes.0.respondedAt', null)
            ->assertJsonPath('data.activeFreightQuote.round', 1)
            ->assertJsonPath('data.canQuoteFreight', true)
            ->assertJsonPath('data.shippingTotal', 0); // belum disepakati
        $firstId = $first->json('data.freightQuotes.0.id');
        $this->assertDatabaseHas('order_freight_quotes', ['id' => $firstId, 'order_id' => $order->id, 'total' => '815.00', 'created_by' => $admin->id]);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'subject_type' => 'Order', 'subject_id' => $order->id, 'action' => 'POST api/v1/admin/orders/{order}/freight-quotes']);

        // Customer melihat penawaran dan boleh menerima/membalas.
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->getJson('/api/v1/customer/orders/'.$order->number)->assertOk()
            ->assertJsonPath('data.activeFreightQuote.id', $firstId)->assertJsonPath('data.canAcceptFreightQuote', true)->assertJsonPath('data.canCounterFreightQuote', true);
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.freight_quoted')->count());
        $this->assertStringContainsString('USD 815.00', UserNotification::where('type', 'order.freight_quoted')->first()->body['en']);
        Mail::assertQueued(FreightQuoted::class, fn (FreightQuoted $mail) => $mail->hasTo('buyer@rubbertrade.example') && ! $mail->extended && $mail->quote->round === 1);

        // Putaran 2 dengan tanggal saja = akhir hari itu; putaran 1 menjadi superseded.
        $this->app['auth']->forgetGuards();
        $second = $this->actingAs($admin)->postJson($this->adminUrl($order), ['lines' => [['label' => 'All-in freight', 'amount' => 80000]], 'validUntil' => '2026-11-12'])->assertStatus(201);
        $second->assertJsonCount(2, 'data.freightQuotes')
            ->assertJsonPath('data.freightQuotes.0.round', 2)->assertJsonPath('data.freightQuotes.0.total', 80000)->assertJsonPath('data.freightQuotes.0.validUntil', '2026-11-12T23:59:59+07:00')
            ->assertJsonPath('data.freightQuotes.1.round', 1)->assertJsonPath('data.freightQuotes.1.status', 'superseded')
            ->assertJsonPath('data.activeFreightQuote.round', 2);
        $this->assertNotNull(OrderFreightQuote::find($firstId)->responded_at);
        Mail::assertQueued(FreightQuoted::class, 2);

        // Admin tanpa modul orders → 403; customer ke endpoint admin → 403; order yang tidak menunggu ongkir → 409.
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['payments']))->postJson($this->adminUrl($order), ['lines' => self::LINES])->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->postJson($this->adminUrl($order), ['lines' => self::LINES])->assertStatus(403);
        $fob = app(CheckoutService::class)->place($this->exporter, $this->exportCheckoutPayload($product, 50));
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)->postJson($this->adminUrl($fob), ['lines' => self::LINES])->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_NOT_ALLOWED')->assertJsonPath('meta.status', 'pending_payment');
    }

    public function test_customer_accept_creates_usd_payment_recomputes_totals_and_moves_to_pending_payment(): void
    {
        Mail::fake();
        // Order dibuat sebelum waktu terima (bukan jam sistem), agar urutan riwayat status tidak bergantung jam test.
        Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:00', config('app.timezone')));
        $product = $this->setUpCif();
        $order = $this->cifOrder($product);
        $admin = $this->adminWith(['orders']);
        $quote = $this->propose($order, $admin);
        Carbon::setTestNow(Carbon::parse('2026-11-04 10:30:00', config('app.timezone')));

        $sql = [];
        DB::listen(function ($query) use (&$sql) {
            $sql[] = $query->sql;
        });
        $response = $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/'.$quote->id.'/accept')->assertOk();
        $this->assertTrue(collect($sql)->contains(fn ($s) => str_contains(strtolower($s), 'for update') && str_contains($s, '"orders"')), 'accept must lock the order row');

        // 100 kg × USD 12,50 = 1.250,00 + fee 25,00 + ongkir 815,00 = USD 2.090,00; batas bayar 120 jam.
        $response->assertJsonPath('data.status', 'pending_payment')
            ->assertJsonPath('data.paymentStatus', 'pending')
            ->assertJsonPath('data.shippingTotal', 81500)
            ->assertJsonPath('data.grandTotal', 209000)
            ->assertJsonPath('data.uniqueCode', 0)
            ->assertJsonPath('data.paymentDueAt', '2026-11-09T10:30:00+07:00')
            ->assertJsonPath('data.shippingMethod.type', 'quoted')->assertJsonPath('data.shippingMethod.amount', 81500)
            ->assertJsonPath('data.shippingMethod.quoteId', $quote->id)->assertJsonCount(3, 'data.shippingMethod.lines')->assertJsonPath('data.shippingMethod.lines.2.label', 'Insurance')
            ->assertJsonPath('data.freightQuotes.0.status', 'accepted')
            ->assertJsonPath('data.activeFreightQuote', null)
            ->assertJsonPath('data.canAcceptFreightQuote', false)->assertJsonPath('data.canQuoteFreight', false)
            ->assertJsonPath('data.canUploadProof', true)->assertJsonPath('data.canCancel', true)
            ->assertJsonCount(1, 'data.payments')
            ->assertJsonPath('data.activePayment.currency', 'USD')->assertJsonPath('data.activePayment.amount', 209000)->assertJsonPath('data.activePayment.method', 'manual_transfer')
            ->assertJsonPath('data.activePayment.bankAccount.currency', 'USD')->assertJsonPath('data.activePayment.bankAccount.accountNumber', $this->usdBank->account_number)
            ->assertJsonPath('data.timeline.1.status', 'pending_payment')->assertJsonPath('data.timeline.1.fromStatus', 'awaiting_freight')
            ->assertJsonPath('data.timeline.1.note', 'Freight of USD 815.00 agreed; awaiting payment.')
            ->assertJsonPath('data.timeline.1.meta.quoteId', $quote->id)->assertJsonPath('data.timeline.1.meta.freightTotal', 81500)->assertJsonPath('data.timeline.1.meta.acceptedBy', 'customer')
            ->assertJsonPath('data.timeline.1.actor.id', $this->exporter->id);
        $this->assertNotNull($response->json('data.freightQuotes.0.respondedAt'));

        $order->refresh();
        $this->assertSame('815.00', $order->shipping_total);
        $this->assertSame('2090.00', $order->grand_total);
        $this->assertSame(81500, $order->shippingTotalInt());
        $payment = $order->activePayment();
        $this->assertSame('2090.00', $payment->amount);
        $this->assertSame($this->usdBank->id, $payment->bank_account_id);
        $this->assertSame($order->payment_due_at->toApiString(), $payment->expires_at->toApiString());
        $this->assertSame(100, $product->fresh()->reserved_qty); // reservasi tetap sampai dibayar

        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.freight_accepted')->count());
        Mail::assertQueued(FreightAccepted::class, fn (FreightAccepted $mail) => $mail->hasTo('buyer@rubbertrade.example') && $mail->payment?->id === $payment->id);
        Mail::assertQueued(FreightAcceptedAdmin::class, fn (FreightAcceptedAdmin $mail) => $mail->hasTo($admin->email) && $mail->acceptedBy === 'customer');

        // Accept kedua (tab lain / balapan): 409, order tidak berubah, payment tetap satu.
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/'.$quote->id.'/accept')->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_STALE');
        $this->assertSame(1, Payment::where('order_id', $order->id)->count());
        $this->assertSame(1, $order->histories()->where('to_status', 'pending_payment')->count());

        // Siklus bayar biasa berlanjut: bukti → verifikasi → paid (stok di-commit).
        $uploaded = app(PaymentService::class)->uploadProof($order->fresh(), $this->proofFile(), null, $this->exporter);
        app(PaymentService::class)->accept($uploaded, $admin);
        $order->refresh();
        $this->assertSame('paid', $order->status);
        $this->assertNotNull($order->invoice_number);
        $this->assertSame([900, 0], [$product->fresh()->stock_qty, $product->fresh()->reserved_qty]);
    }

    public function test_accept_rejects_expired_and_stale_quotes_and_admin_can_extend_validity(): void
    {
        Mail::fake();
        $product = $this->setUpCif();
        $admin = $this->adminWith(['orders']);
        Carbon::setTestNow(Carbon::parse('2026-11-03 09:00:00', config('app.timezone')));
        $order = $this->cifOrder($product);
        $quote = $this->propose($order, $admin, self::LINES, ['validUntil' => '2026-11-04T09:00:00+07:00']);

        // Lewat masa berlaku sebelum scheduler jalan: balasan dan accept ditolak, penawaran ditandai expired.
        Carbon::setTestNow(Carbon::parse('2026-11-05 09:00:00', config('app.timezone')));
        $this->actingAs($this->exporter)->getJson('/api/v1/customer/orders/'.$order->number)->assertOk()
            ->assertJsonPath('data.activeFreightQuote.expired', true)->assertJsonPath('data.canAcceptFreightQuote', false)->assertJsonPath('data.canCounterFreightQuote', false);
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/counter', ['amount' => 70000])->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_EXPIRED');
        $this->assertSame('expired', $quote->fresh()->status); // ditandai walau scheduler belum jalan, admin diberi tahu seperti scheduler
        Mail::assertQueued(FreightQuoteExpiredAdmin::class, fn (FreightQuoteExpiredAdmin $mail) => $mail->quote->id === $quote->id);
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.freight_expired')->count());
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/'.$quote->id.'/accept')->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_EXPIRED')->assertJsonPath('meta.quoteId', $quote->id);
        $this->assertSame('awaiting_freight', $order->fresh()->status);
        $this->assertSame(0, Payment::count());

        // Admin memperpanjang: masa lalu 422; masa depan → proposed lagi, customer diberi tahu, lalu accept berhasil.
        $this->app['auth']->forgetGuards();
        $extendUrl = $this->adminUrl($order).'/'.$quote->id.'/extend';
        $this->actingAs($admin)->putJson($extendUrl, [])->assertStatus(422)->assertJsonValidationErrors(['validUntil']);
        $this->actingAs($admin)->putJson($extendUrl, ['validUntil' => '2026-11-04'])->assertStatus(422)->assertJsonValidationErrors(['validUntil']);
        $this->actingAs($admin)->putJson($extendUrl, ['validUntil' => '2026-11-15'])->assertOk()
            ->assertJsonPath('data.freightQuotes.0.id', $quote->id)
            ->assertJsonPath('data.freightQuotes.0.status', 'proposed')
            ->assertJsonPath('data.freightQuotes.0.expired', false)
            ->assertJsonPath('data.freightQuotes.0.validUntil', '2026-11-15T23:59:59+07:00')
            ->assertJsonPath('data.canAcceptFreightQuote', true);
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.freight_quote_extended')->count());
        Mail::assertQueued(FreightQuoted::class, fn (FreightQuoted $mail) => $mail->extended);

        // Stale: penawaran baru menggantikan; accept putaran lama → 409 FREIGHT_QUOTE_STALE; penawaran order lain → 404.
        $newer = $this->propose($order, $admin, [['label' => 'All-in', 'amount' => 79000]]);
        $other = $this->cifOrder($product, 50);
        $otherQuote = $this->propose($other, $admin);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/'.$quote->id.'/accept')->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_STALE')->assertJsonPath('meta.status', 'superseded');
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/'.$otherQuote->id.'/accept')->assertStatus(404);
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/999999/accept')->assertStatus(404);
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/'.$newer->id.'/accept')->assertOk()
            ->assertJsonPath('data.status', 'pending_payment')->assertJsonPath('data.shippingTotal', 79000);

        // Extend hanya untuk penawaran admin yang proposed/expired dan merupakan putaran terakhir.
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)->putJson($this->adminUrl($order).'/'.$quote->id.'/extend', ['validUntil' => '2026-11-20'])->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_NOT_ALLOWED'); // order sudah pending_payment
        $this->actingAs($admin)->putJson($this->adminUrl($other).'/'.$quote->id.'/extend', ['validUntil' => '2026-11-20'])->assertStatus(404);
    }

    public function test_customer_counter_offer_then_admin_accepts_it(): void
    {
        Mail::fake();
        $product = $this->setUpCif();
        Carbon::setTestNow(Carbon::parse('2026-11-03 09:00:00', config('app.timezone')));
        $order = $this->cifOrder($product);
        $admin = $this->adminWith(['orders']);
        $quote = $this->propose($order, $admin);

        // Balasan sebelum ada penawaran: order lain tanpa penawaran → 409.
        $empty = $this->cifOrder($product, 50);
        $this->actingAs($this->exporter)->postJson($this->customerUrl($empty).'/counter', ['amount' => 70000])->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_NOT_ALLOWED');
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/counter', ['amount' => 0])->assertStatus(422)->assertJsonValidationErrors(['amount']);

        $counter = $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/counter', ['amount' => 70000, 'note' => 'Competitor quoted USD 700 all-in.'])->assertOk();
        $counter->assertJsonPath('data.status', 'awaiting_freight')
            ->assertJsonCount(2, 'data.freightQuotes')
            ->assertJsonPath('data.freightQuotes.0.round', 2)
            ->assertJsonPath('data.freightQuotes.0.proposedBy', 'customer')
            ->assertJsonPath('data.freightQuotes.0.lines', [['label' => 'Penawaran customer', 'amount' => 70000]])
            ->assertJsonPath('data.freightQuotes.0.total', 70000)
            ->assertJsonPath('data.freightQuotes.0.note', 'Competitor quoted USD 700 all-in.')
            ->assertJsonPath('data.freightQuotes.0.validUntil', null)
            ->assertJsonPath('data.freightQuotes.0.status', 'proposed')
            ->assertJsonPath('data.freightQuotes.0.createdBy.id', $this->exporter->id)
            ->assertJsonPath('data.freightQuotes.1.id', $quote->id)->assertJsonPath('data.freightQuotes.1.status', 'superseded')
            ->assertJsonPath('data.activeFreightQuote.proposedBy', 'customer')
            ->assertJsonPath('data.canAcceptFreightQuote', false)->assertJsonPath('data.canCounterFreightQuote', false)->assertJsonPath('data.canQuoteFreight', true);
        $counterId = $counter->json('data.freightQuotes.0.id');
        Mail::assertQueued(FreightCounteredAdmin::class, fn (FreightCounteredAdmin $mail) => $mail->hasTo($admin->email) && $mail->quote->id === $counterId);
        $this->assertSame(0, UserNotification::where('type', 'order.freight_quoted')->where('user_id', '!=', $this->exporter->id)->count());

        // Customer tidak bisa membalas lagi atau menerima balasannya sendiri; admin tidak bisa menerima penawarannya sendiri.
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/counter', ['amount' => 65000])->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_NOT_ALLOWED');
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/'.$counterId.'/accept')->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_NOT_ALLOWED');
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)->postJson($this->adminUrl($order).'/'.$quote->id.'/accept')->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_STALE');

        // Admin menerima balasan: efek sama dengan customer menerima penawaran.
        $this->actingAs($admin)->postJson($this->adminUrl($order).'/'.$counterId.'/accept')->assertOk()
            ->assertJsonPath('data.status', 'pending_payment')
            ->assertJsonPath('data.shippingTotal', 70000)
            ->assertJsonPath('data.grandTotal', 197500)
            ->assertJsonPath('data.paymentDueAt', '2026-11-08T09:00:00+07:00')
            ->assertJsonPath('data.freightQuotes.0.status', 'accepted')
            ->assertJsonPath('data.activePayment.amount', 197500)
            ->assertJsonPath('data.timeline.1.meta.acceptedBy', 'admin')
            ->assertJsonPath('data.timeline.1.actor.id', $admin->id);
        $this->assertSame('700.00', $order->fresh()->shipping_total);
        Mail::assertQueued(FreightAccepted::class, fn (FreightAccepted $mail) => $mail->hasTo('buyer@rubbertrade.example'));
        Mail::assertQueued(FreightAcceptedAdmin::class, fn (FreightAcceptedAdmin $mail) => $mail->acceptedBy === 'admin');
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'subject_type' => 'Order', 'subject_id' => $order->id, 'action' => 'POST api/v1/admin/orders/{order}/freight-quotes/{quote}/accept']);

        // Admin kedua kali → 409; tidak ada payment ganda.
        $this->actingAs($admin)->postJson($this->adminUrl($order).'/'.$counterId.'/accept')->assertStatus(409);
        $this->assertSame(1, Payment::where('order_id', $order->id)->count());
    }

    public function test_cancel_in_awaiting_freight_releases_stock_and_rejects_open_quotes(): void
    {
        Mail::fake();
        $product = $this->setUpCif();
        $admin = $this->adminWith(['orders']);
        $order = $this->cifOrder($product);
        $quote = $this->propose($order, $admin);
        $this->assertSame(100, $product->fresh()->reserved_qty);

        $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders/'.$order->number.'/cancel', ['reason' => 'Changed plans'])->assertOk()
            ->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.cancelReason', 'Changed plans')
            ->assertJsonPath('data.freightQuotes.0.status', 'rejected')->assertJsonPath('data.activeFreightQuote', null)
            ->assertJsonPath('data.canCancel', false)->assertJsonPath('data.canQuoteFreight', false)->assertJsonPath('data.payments', []);
        $this->assertSame(0, $product->fresh()->reserved_qty);
        $this->assertSame(1, StockMovement::where('type', StockMovement::TYPE_RELEASE)->where('reference_id', $order->id)->count());
        $this->assertNotNull($quote->fresh()->responded_at);
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.cancelled')->count());
        Mail::assertQueued(OrderCancelled::class);

        // Setelah batal: tidak ada penawaran/aksi lagi.
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)->postJson($this->adminUrl($order), ['lines' => self::LINES])->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_NOT_ALLOWED');
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->postJson($this->customerUrl($order).'/'.$quote->id.'/accept')->assertStatus(409)->assertJsonPath('code', 'FREIGHT_QUOTE_STALE');

        // Admin membatalkan order awaiting_freight lain (alasan wajib): stok dilepas juga.
        $second = $this->cifOrder($product, 40);
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$second->number.'/cancel', ['reason' => 'No vessel available'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame(0, $product->fresh()->reserved_qty);
    }

    public function test_freight_expire_command_expires_quotes_and_cancels_orders_past_max_wait_idempotently(): void
    {
        Mail::fake();
        $product = $this->setUpCif();
        $this->commerceSettings(['freightQuoteMaxDays' => 30, 'freightQuoteValidDays' => 7]);
        $admin = $this->adminWith(['orders']);
        Carbon::setTestNow(Carbon::parse('2026-11-03 09:00:00', config('app.timezone')));

        $quoted = $this->cifOrder($product, 100);      // penawaran admin berlaku 2 hari
        $silent = $this->cifOrder($product, 50);       // tidak pernah ditawar
        $countered = $this->cifOrder($product, 30);    // balasan customer (tanpa masa berlaku) menunggu admin
        $quotedQuote = $this->propose($quoted, $admin, self::LINES, ['validUntil' => '2026-11-05T09:00:00+07:00']);
        $this->propose($countered, $admin);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->postJson($this->customerUrl($countered).'/counter', ['amount' => 60000])->assertOk();
        $this->assertSame(180, $product->fresh()->reserved_qty);

        // Belum ada yang lewat.
        $this->artisan('orders:freight-expire')->expectsOutput('0 quote(s) expired, 0 order(s) cancelled.')->assertExitCode(0);

        // Hari ke-3: penawaran kedaluwarsa (customer in-app, admin email), order tetap menunggu.
        Carbon::setTestNow(Carbon::parse('2026-11-06 09:00:00', config('app.timezone')));
        $this->artisan('orders:freight-expire')->expectsOutput('1 quote(s) expired, 0 order(s) cancelled.')->assertExitCode(0);
        $this->artisan('orders:freight-expire')->expectsOutput('0 quote(s) expired, 0 order(s) cancelled.')->assertExitCode(0);
        $this->assertSame('expired', $quotedQuote->fresh()->status);
        $this->assertSame('awaiting_freight', $quoted->fresh()->status);
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.freight_expired')->count());
        Mail::assertQueued(FreightQuoteExpiredAdmin::class, fn (FreightQuoteExpiredAdmin $mail) => $mail->hasTo($admin->email) && $mail->quote->id === $quotedQuote->id);
        $this->assertDatabaseHas('audit_logs', ['subject_type' => 'OrderFreightQuote', 'subject_id' => $quotedQuote->id, 'action' => 'freight_quote.expired [system]']);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->superAdmin())->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.workQueue.freightToQuote', 3); // ketiganya menunggu admin

        // Hari ke-31: order tanpa penawaran yang masih berlaku dibatalkan (stok dilepas); balasan customer yang terbuka menahan pembatalan.
        Carbon::setTestNow(Carbon::parse('2026-12-04 09:00:01', config('app.timezone')));
        $this->artisan('orders:freight-expire')->expectsOutput('0 quote(s) expired, 2 order(s) cancelled.')->assertExitCode(0);
        $this->artisan('orders:freight-expire')->expectsOutput('0 quote(s) expired, 0 order(s) cancelled.')->assertExitCode(0);

        foreach ([$quoted, $silent] as $order) {
            $order->refresh();
            $this->assertSame('cancelled', $order->status);
            $this->assertSame('The waiting period for a freight quote has passed.', $order->cancel_reason);
            $this->assertNotNull($order->cancelled_at);
            $this->assertDatabaseHas('order_status_histories', ['order_id' => $order->id, 'from_status' => 'awaiting_freight', 'to_status' => 'cancelled', 'actor_type' => 'system']);
            $this->assertDatabaseHas('audit_logs', ['subject_type' => 'Order', 'subject_id' => $order->id, 'action' => 'order.cancelled [system]']);
            $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.freight_cancelled')->whereRaw("data->>'orderNumber' = ?", [$order->number])->count());
        }
        $this->assertSame('expired', $quotedQuote->fresh()->status); // yang sudah expired tidak diubah menjadi rejected
        $this->assertSame('awaiting_freight', $countered->fresh()->status);
        $this->assertSame(30, $product->fresh()->reserved_qty);
        $this->assertSame(2, StockMovement::where('type', StockMovement::TYPE_RELEASE)->count());
        Mail::assertQueued(OrderCancelled::class, 2);

        // Setting 0 hari tidak mungkin (min 1); admin bisa mematikan sementara lewat angka besar. Balasan customer diterima admin setelah lama pun tetap sah.
        $this->app['auth']->forgetGuards();
        $counterId = $countered->fresh()->activeFreightQuote()->id;
        $this->actingAs($admin)->postJson($this->adminUrl($countered).'/'.$counterId.'/accept')->assertOk()->assertJsonPath('data.status', 'pending_payment');
    }

    public function test_other_customers_get_404_and_local_customers_cannot_use_cif(): void
    {
        $product = $this->setUpCif();
        $order = $this->cifOrder($product);
        $admin = $this->adminWith(['orders']);
        $quote = $this->propose($order, $admin);

        // Customer lain (lokal) tidak melihat order ini.
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$order->number)->assertStatus(404);
        $this->actingAs($this->buyer)->postJson($this->customerUrl($order).'/'.$quote->id.'/accept')->assertStatus(404);
        $this->actingAs($this->buyer)->postJson($this->customerUrl($order).'/counter', ['amount' => 1000])->assertStatus(404);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/cancel')->assertStatus(404);
        $this->assertSame('proposed', $quote->fresh()->status);

        // Term CIF adalah pasar ekspor: customer lokal ditolak 422 deliveryTermCode walau mengirim pelabuhan tujuan.
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1, ['deliveryTermCode' => 'cif', 'destinationPort' => self::PORT]))
            ->assertStatus(422)->assertJsonValidationErrors(['deliveryTermCode']);

        // Tanpa login → 401; customer pending (belum disetujui) → 403 pada aksi penawaran.
        $this->app['auth']->forgetGuards();
        $this->postJson($this->customerUrl($order).'/'.$quote->id.'/accept')->assertStatus(401);
        $pending = $this->customer(['status' => User::STATUS_PENDING]);
        $this->actingAs($pending)->postJson($this->customerUrl($order).'/'.$quote->id.'/accept')->assertStatus(403);
    }

    public function test_accept_falls_back_only_to_manual_transfer_and_same_currency_bank_or_returns_409(): void
    {
        Mail::fake();
        $product = $this->setUpCif();
        $order = $this->cifOrder($product);
        $quote = $this->propose($order, $this->adminWith(['orders']));
        $acceptUrl = $this->customerUrl($order).'/'.$quote->id.'/accept';

        // Metode checkout dinonaktifkan dan yang aktif tinggal QRIS statis (driver manual): order USD tidak boleh memakai QRIS.
        $this->manualTransfer->forceFill(['is_active' => false])->save();
        $this->makePaymentMethod('qris_static', ['type' => PaymentMethod::TYPE_QRIS_STATIC]);
        $this->actingAs($this->exporter)->postJson($acceptUrl)->assertStatus(409)
            ->assertJsonPath('code', 'FREIGHT_PAYMENT_UNAVAILABLE')->assertJsonPath('meta.missing', 'paymentMethod')->assertJsonPath('meta.currency', 'USD');
        $this->assertSame('awaiting_freight', $order->fresh()->status);
        $this->assertSame('proposed', $quote->fresh()->status);
        $this->assertSame(0, Payment::where('order_id', $order->id)->count());

        // Transfer manual lain aktif, tetapi rekening USD pilihan checkout nonaktif dan hanya rekening IDR yang aktif: 409.
        $this->makePaymentMethod('transfer_usd', ['type' => PaymentMethod::TYPE_MANUAL_TRANSFER, 'sort_order' => 5]);
        $this->usdBank->forceFill(['is_active' => false])->save();
        $this->actingAs($this->exporter)->postJson($acceptUrl)->assertStatus(409)
            ->assertJsonPath('code', 'FREIGHT_PAYMENT_UNAVAILABLE')->assertJsonPath('meta.missing', 'bankAccount');
        $this->assertSame('proposed', $quote->fresh()->status);
        $this->assertSame(0, Payment::where('order_id', $order->id)->count());

        // Rekening USD lain aktif: accept memakai transfer manual pengganti dan rekening USD itu.
        $usd2 = BankAccount::create([
            'bank_name' => 'Bank BNI', 'account_number' => '2220001112', 'account_holder' => 'PT Industri Karet Nusantara',
            'currency' => 'USD', 'swift_code' => 'BNINIDJA', 'is_active' => true, 'sort_order' => 1,
        ]);
        $this->actingAs($this->exporter)->postJson($acceptUrl)->assertOk()
            ->assertJsonPath('data.status', 'pending_payment')
            ->assertJsonPath('data.activePayment.method', 'transfer_usd')
            ->assertJsonPath('data.activePayment.currency', 'USD')
            ->assertJsonPath('data.activePayment.bankAccount.accountNumber', $usd2->account_number);
    }

    public function test_local_quoted_term_gets_its_unique_code_only_when_freight_is_accepted(): void
    {
        Mail::fake();
        $this->setUpCommerce(); // IDR, kode unik aktif, harga termasuk pajak
        $product = $this->makeProduct(['price' => 100000], 100);
        $this->makeDeliveryTerm([
            'code' => 'kapal-lokal', 'family' => DeliveryTerm::FAMILY_PORT, 'market' => DeliveryTerm::MARKET_LOCAL,
            'pricing_mode' => DeliveryTerm::PRICING_QUOTED, 'sort_order' => 9,
        ]);
        $payload = [
            'items' => [['productSlug' => $product->slug, 'qty' => 2]], 'deliveryTermCode' => 'kapal-lokal',
            'paymentMethodCode' => $this->manualTransfer->code, 'bankAccountId' => $this->bank->id,
        ];

        // Pratinjau sama dengan checkout: belum ada kode unik selama ongkir belum disepakati.
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', $payload)->assertOk()
            ->assertJsonPath('data.uniqueCodeRequired', false)->assertJsonPath('data.uniqueCode', 0)->assertJsonPath('data.grandTotal', 200000);
        $order = app(CheckoutService::class)->place($this->buyer, $payload);
        $this->assertSame([Order::STATUS_AWAITING_FREIGHT, 0], [$order->status, (int) $order->unique_code]);

        $quote = $this->propose($order, $this->adminWith(['orders']), [['label' => 'Kapal Belawan - Batam', 'amount' => 150000]]);
        $response = $this->actingAs($this->buyer)->postJson($this->customerUrl($order).'/'.$quote->id.'/accept')->assertOk()
            ->assertJsonPath('data.status', 'pending_payment')->assertJsonPath('data.currency', 'IDR');

        $order->refresh();
        $code = (int) $order->unique_code;
        $this->assertGreaterThanOrEqual(1, $code);
        $this->assertLessThanOrEqual(999, $code);
        $response->assertJsonPath('data.uniqueCode', $code)->assertJsonPath('data.grandTotal', 350000 + $code);
        $this->assertSame(350000 + $code, $order->grandTotalInt());
        $this->assertSame(350000 + $code, $order->activePayment()->amountInt());
    }

    public function test_only_open_quotes_past_valid_until_are_reported_expired(): void
    {
        $past = now()->subDay();
        $quote = fn (string $status, $validUntil) => (new OrderFreightQuote())->forceFill(['status' => $status, 'valid_until' => $validUntil, 'lines' => []]);

        $this->assertTrue($quote(OrderFreightQuote::STATUS_PROPOSED, $past)->isExpired());
        $this->assertTrue($quote(OrderFreightQuote::STATUS_EXPIRED, now()->addDay())->isExpired());
        $this->assertFalse($quote(OrderFreightQuote::STATUS_PROPOSED, now()->addDay())->isExpired());
        foreach ([OrderFreightQuote::STATUS_ACCEPTED, OrderFreightQuote::STATUS_SUPERSEDED, OrderFreightQuote::STATUS_REJECTED] as $closed) {
            $this->assertFalse($quote($closed, $past)->isExpired(), $closed);
            $this->assertFalse($quote($closed, $past)->toSummary()['expired'], $closed);
        }
    }

    public function test_freight_quoted_mail_renders_in_english_and_indonesian(): void
    {
        Mail::fake();
        $product = $this->setUpCif();
        $order = $this->cifOrder($product);
        $quote = $this->propose($order, $this->adminWith(['orders']));
        $order->refresh();

        // Customer ekspor ber-locale en: 1.250,00 + fee 25,00 + ongkir 815,00 = USD 2.090,00.
        $en = $this->renderMail(new FreightQuoted($order, $quote));
        $this->assertStringContainsString('Freight quote for order '.$order->number, $en);
        $this->assertStringContainsString('Port Klang', $en);
        $this->assertStringContainsString('Ocean freight Belawan - Port Klang', $en);
        $this->assertStringContainsString('USD 815.00', $en);
        $this->assertStringContainsString('Estimated total including freight', $en);
        $this->assertStringContainsString('USD 2,090.00', $en);
        $this->assertStringContainsString('/dashboard/pesanan/'.$order->number, $en);

        $id = $this->renderMail((new FreightQuoted($order, $quote))->locale('id'));
        $this->assertStringContainsString('Penawaran ongkir untuk pesanan '.$order->number, $id);
        $this->assertStringContainsString('Perkiraan total setelah ongkir', $id);
        $this->assertStringContainsString('USD 2,090.00', $id);

        $extended = $this->renderMail(new FreightQuoted($order, $quote, true));
        $this->assertStringContainsString('has been extended until', $extended);
    }

    private function renderMail(Mailable $mail): string
    {
        $this->app->instance('mailer', (new MailManager($this->app))->mailer());
        try {
            return $mail->render();
        } finally {
            $this->app->forgetInstance('mailer');
        }
    }
}
