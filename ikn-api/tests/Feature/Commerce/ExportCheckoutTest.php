<?php

namespace Tests\Feature\Commerce;

use App\Mail\Commerce\OrderPlaced;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

/**
 * Order USD FOB customer ekspor (kontrak bagian 9/10, 11.9, 11.10; ASUMSI A-86, A-87): harga USD dalam sen, pajak dari
 * export_tax_rate, tanpa kode unik dan voucher, fee se-mata-uang, hanya transfer manual ke rekening USD, syarat bayar
 * wajib dan dibekukan, batas bayar export_payment_due_hours, angka DB decimal satuan mayor (12.50) ↔ JSON sen (1250).
 */
class ExportCheckoutTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function setUpExportScenario(): \App\Models\Product
    {
        $this->setUpCommerce(['taxRate' => 11, 'priceIncludesTax' => true, 'uniqueCodeEnabled' => true]);
        $this->setUpExport();
        $this->makeFee(5000); // IDR, tidak boleh ikut order USD
        $this->makeFee(2500, true, 'USD'); // USD 25,00
        $this->makePaymentMethod('qris_static', ['sort_order' => 1]);

        return $this->makeProduct(['slug' => 'resiprene-35', 'code' => 'RSP-35', 'price' => 185000, 'promo_price' => 150000, 'price_usd' => '12.50', 'moq' => 25, 'unit' => 'kg'], 1000);
    }

    public function test_quote_for_export_customer_is_in_usd_cents_with_export_tax_fee_filter_and_no_unique_code(): void
    {
        $product = $this->setUpExportScenario();

        $quote = $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => $product->slug, 'qty' => 100]], 'paymentMethodCode' => 'manual_transfer', 'paymentTermCode' => 'tt_advance',
        ])->assertOk();

        // 100 kg × USD 12,50 = USD 1.250,00 + fee USD 25,00; promo rupiah tidak berlaku; pajak ekspor 0.
        $quote->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.deliveryTerm.code', 'fob')->assertJsonPath('data.deliveryTerm.taxProfile', 'export')
            ->assertJsonPath('data.paymentTerm.code', 'tt_advance')->assertJsonPath('data.paymentTerm.name.en', '100% T/T in advance')
            ->assertJsonPath('data.items.0.unitPrice', 1250)->assertJsonPath('data.items.0.basePrice', 1250)->assertJsonPath('data.items.0.promoApplied', false)
            ->assertJsonPath('data.items.0.lineTotal', 125000)
            ->assertJsonPath('data.subtotal', 125000)->assertJsonPath('data.discountTotal', 0)
            ->assertJsonPath('data.shipping.type', 'included')->assertJsonPath('data.shippingTotal', 0)
            ->assertJsonCount(1, 'data.fees')->assertJsonPath('data.fees.0.amount', 2500)->assertJsonPath('data.fees.0.currency', 'USD')->assertJsonPath('data.feeTotal', 2500)
            ->assertJsonPath('data.taxRate', 0)->assertJsonPath('data.taxTotal', 0)
            ->assertJsonPath('data.uniqueCodeRequired', false)->assertJsonPath('data.uniqueCode', 0)
            ->assertJsonPath('data.grandTotal', 127500)->assertJsonPath('data.warnings', []);

        // Pajak ekspor eksklusif 10% ditambahkan; PPN 11% tetap tidak dipakai.
        $this->commerceSettings(['exportTaxRate' => 10, 'priceIncludesTax' => false]);
        $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 100]]])
            ->assertOk()->assertJsonPath('data.taxRate', 10)->assertJsonPath('data.taxTotal', 12500)->assertJsonPath('data.grandTotal', 140000);
        $this->commerceSettings(['exportTaxRate' => 0, 'priceIncludesTax' => true]);

        // Voucher ditolak untuk order USD; term lokal (loco) ditolak untuk customer ekspor; QRIS ditolak.
        $this->makeVoucher(['code' => 'IKN10']);
        $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 100]], 'voucherCode' => 'IKN10'])
            ->assertStatus(409)->assertJsonPath('code', 'VOUCHER_INVALID')->assertJsonPath('meta.reason', 'currency');
        $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 100]], 'deliveryTermCode' => 'loco'])
            ->assertStatus(422)->assertJsonValidationErrors(['deliveryTermCode']);
        $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 100]], 'paymentMethodCode' => 'qris_static'])
            ->assertStatus(422)->assertJsonValidationErrors(['paymentMethodCode']);
        $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 100]], 'paymentTermCode' => 'tidak-ada'])
            ->assertStatus(422)->assertJsonValidationErrors(['paymentTermCode']);

        // Produk tanpa harga USD tidak bisa dipesan customer ekspor.
        $noUsd = $this->makeProduct(['slug' => 'sarung-egrek', 'price' => 125000], 100);
        $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $noUsd->slug, 'qty' => 1]]])
            ->assertStatus(422)->assertJsonValidationErrors(['items.0.productSlug']);
    }

    public function test_checkout_usd_fob_requires_payment_term_and_usd_bank_and_stores_exact_cents(): void
    {
        Mail::fake();
        $product = $this->setUpExportScenario();
        $this->commerceSettings(['exportPaymentDueHours' => 120, 'paymentDueHours' => 24]);
        Carbon::setTestNow(Carbon::parse('2026-11-03 09:00:00', config('app.timezone')));

        // Syarat bayar wajib untuk customer ekspor; rekening IDR dan QRIS ditolak.
        $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders', $this->exportCheckoutPayload($product, 100, ['paymentTermCode' => null]))
            ->assertStatus(422)->assertJsonValidationErrors(['paymentTermCode']);
        $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders', $this->exportCheckoutPayload($product, 100, ['bankAccountId' => $this->bank->id]))
            ->assertStatus(422)->assertJsonValidationErrors(['bankAccountId']);
        $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders', $this->exportCheckoutPayload($product, 100, ['paymentMethodCode' => 'qris_static', 'bankAccountId' => null]))
            ->assertStatus(422)->assertJsonValidationErrors(['paymentMethodCode']);
        $this->assertSame(0, Order::count());

        $response = $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders', $this->exportCheckoutPayload($product, 100, ['note' => 'Earliest vessel please.']))
            ->assertStatus(201);
        $number = $response->json('data.number');

        $response->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.status', 'pending_payment')
            ->assertJsonPath('data.customer.market', 'export')->assertJsonPath('data.customer.countryCode', 'MY')
            ->assertJsonPath('data.items.0.currency', 'USD')->assertJsonPath('data.items.0.unitPrice', 1250)->assertJsonPath('data.items.0.lineTotal', 125000)
            ->assertJsonPath('data.subtotal', 125000)->assertJsonPath('data.shippingTotal', 0)->assertJsonPath('data.feeTotal', 2500)
            ->assertJsonPath('data.taxTotal', 0)->assertJsonPath('data.taxRate', 0)->assertJsonPath('data.uniqueCode', 0)->assertJsonPath('data.grandTotal', 127500)
            ->assertJsonPath('data.shippingMethod.type', 'included')->assertJsonPath('data.shippingMethod.amount', 0)
            ->assertJsonPath('data.deliveryTerm.code', 'fob')->assertJsonPath('data.deliveryTerm.family', 'port')->assertJsonPath('data.deliveryTerm.loadingPort', 'Belawan')
            ->assertJsonPath('data.paymentTerm.code', 'tt_advance')->assertJsonPath('data.paymentTerm.name.id', 'Pembayaran 100% di muka (T/T)')
            ->assertJsonPath('data.shippingAddress.type', 'port')->assertJsonPath('data.shippingAddress.loadingPort', 'Belawan')
            ->assertJsonPath('data.shippingAddress.label.en', 'FOB Belawan')->assertJsonPath('data.shippingAddress.companyName', 'Rubber Trade Sdn. Bhd.')
            ->assertJsonPath('data.shippingAddress.countryCode', 'MY')->assertJsonPath('data.pickup', null)
            ->assertJsonPath('data.paymentDueAt', '2026-11-08T09:00:00+07:00')
            ->assertJsonPath('data.payment.currency', 'USD')->assertJsonPath('data.payment.amount', 127500)->assertJsonPath('data.payment.uniqueCode', 0)
            ->assertJsonPath('data.payment.bankAccount.currency', 'USD')->assertJsonPath('data.payment.bankAccount.swiftCode', 'BMRIIDJA')
            ->assertJsonPath('data.payment.receivedAmount', null);

        // DB: decimal satuan mayor; JSON: sen. 12.50 bulat-balik persis.
        $order = Order::where('number', $number)->firstOrFail();
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'currency' => 'USD', 'subtotal' => '1250.00', 'fee_total' => '25.00', 'grand_total' => '1275.00', 'unique_code' => 0, 'payment_term_code' => 'tt_advance']);
        $this->assertDatabaseHas('order_items', ['order_id' => $order->id, 'currency' => 'USD', 'unit_price' => '12.50', 'line_total' => '1250.00']);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'currency' => 'USD', 'amount' => '1275.00']);
        $this->assertSame('tt_advance', $order->payment_term_snapshot['code']);
        $this->assertSame('Pembayaran 100% di muka (T/T)', $order->payment_term_snapshot['name']['id']);
        $this->assertSame('100% T/T in advance', $order->payment_term_snapshot['name']['en']);
        $this->assertSame(1250, $order->items->first()->unitPriceInt());
        $this->assertSame(127500, $order->grandTotalInt());
        $this->actingAs($this->exporter)->getJson("/api/v1/customer/orders/$number")->assertOk()->assertJsonPath('data.items.0.unitPrice', 1250)->assertJsonPath('data.grandTotal', 127500);
        $this->actingAs($this->exporter)->getJson('/api/v1/customer/orders')->assertOk()->assertJsonPath('data.0.currency', 'USD')->assertJsonPath('data.0.grandTotal', 127500);

        Mail::assertQueued(OrderPlaced::class, fn (OrderPlaced $mail) => $mail->order->is($order));

        // Ganti metode ke QRIS ditolak untuk order USD; ganti rekening USD lain diizinkan tanpa kode unik.
        $this->actingAs($this->exporter)->postJson("/api/v1/customer/orders/$number/payments", ['paymentMethodCode' => 'qris_static'])
            ->assertStatus(422)->assertJsonValidationErrors(['paymentMethodCode']);
        $this->actingAs($this->exporter)->postJson("/api/v1/customer/orders/$number/payments", ['paymentMethodCode' => 'manual_transfer', 'bankAccountId' => $this->bank->id])
            ->assertStatus(422)->assertJsonValidationErrors(['bankAccountId']);
        $this->actingAs($this->exporter)->postJson("/api/v1/customer/orders/$number/payments", ['paymentMethodCode' => 'manual_transfer', 'bankAccountId' => $this->usdBank->id])
            ->assertStatus(201)->assertJsonPath('data.payment.currency', 'USD')->assertJsonPath('data.payment.amount', 127500)->assertJsonPath('data.order.uniqueCode', 0);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'grand_total' => '1275.00']);
    }

    public function test_admin_accept_records_received_amount_and_bank_charges_and_reports_exclude_usd(): void
    {
        Mail::fake();
        $product = $this->setUpExportScenario();
        $admin = $this->superAdmin();
        $usdOrder = app(\App\Services\Commerce\CheckoutService::class)->place($this->exporter, $this->exportCheckoutPayload($product, 100));
        $payment = app(\App\Services\Payment\PaymentService::class)->uploadProof($usdOrder, $this->proofFile(), null, $this->exporter);

        $this->actingAs($admin)->postJson("/api/v1/admin/payments/{$payment->id}/accept", ['receivedAmount' => 'abc'])->assertStatus(422)->assertJsonValidationErrors(['receivedAmount']);
        // Batas decimal(15,2): 13 digit satuan terkecil (sama dengan harga produk dan fee).
        $this->actingAs($admin)->postJson("/api/v1/admin/payments/{$payment->id}/accept", ['receivedAmount' => 10000000000000, 'bankCharges' => 10000000000000])
            ->assertStatus(422)->assertJsonValidationErrors(['receivedAmount', 'bankCharges']);

        $verified = $this->actingAs($admin)->postJson("/api/v1/admin/payments/{$payment->id}/accept", [
            'receivedAmount' => 127000, 'bankCharges' => 500, 'receivedNote' => 'Intermediary bank deducted USD 5.00',
        ])->assertOk();
        $verified->assertJsonPath('data.payment.status', 'paid')->assertJsonPath('data.payment.currency', 'USD')
            ->assertJsonPath('data.payment.receivedAmount', 127000)->assertJsonPath('data.payment.bankCharges', 500)
            ->assertJsonPath('data.payment.receivedNote', 'Intermediary bank deducted USD 5.00')
            ->assertJsonPath('data.order.status', 'paid')->assertJsonPath('data.order.currency', 'USD')->assertJsonPath('data.order.grandTotal', 127500);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'received_amount' => '1270.00', 'bank_charges' => '5.00']);
        $this->assertSame(127000, Payment::findOrFail($payment->id)->receivedAmountInt());
        $this->assertNotNull($usdOrder->fresh()->invoice_number); // seri nomor invoice sama dengan lokal

        // Order IDR lokal dibayar: hanya ini yang masuk agregat laporan dan KPI dashboard (USD tidak dicampur, ASUMSI A-86);
        // daftar order dan CSV memuat keduanya dengan kolom currency, total USD ada di byCurrency (Phase E6).
        $idrProduct = $this->makeProduct(['price' => 100000], 100);
        $idrOrder = $this->payOrder($this->placeOrder($idrProduct, 2), $admin);

        $report = $this->actingAs($admin)->getJson('/api/v1/admin/reports/sales')->assertOk();
        $report->assertJsonPath('data.currency', 'IDR')->assertJsonPath('data.summary.orders', 1)->assertJsonPath('data.summary.revenue', $idrOrder->grandTotalInt())
            ->assertJsonCount(2, 'data.orders')->assertJsonPath('data.orders.0.number', $idrOrder->number)->assertJsonPath('data.orders.1.number', $usdOrder->number)
            ->assertJsonPath('data.orders.1.currency', 'USD')
            ->assertJsonPath('data.byCurrency.1', ['currency' => 'USD', 'orders' => 1, 'revenue' => 127500, 'paidOrders' => 1, 'averageOrder' => 127500]);
        $csv = $this->actingAs($admin)->get('/api/v1/admin/reports/sales?format=csv')->assertOk()->getContent();
        $this->assertStringContainsString(',currency,', $csv);
        $this->assertStringContainsString($usdOrder->number.',', $csv);
        $this->assertStringContainsString(',USD,', $csv);

        $dashboard = $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk();
        $dashboard->assertJsonPath('data.currency', 'IDR')->assertJsonPath('data.stats.revenueThisMonth', $idrOrder->grandTotalInt())
            ->assertJsonPath('data.kpis.revenue.current', $idrOrder->grandTotalInt())->assertJsonPath('data.kpis.paidOrders.current', 1);
        $this->assertSame(1, count(array_filter($dashboard->json('data.topProducts'), fn ($p) => $p['productId'] === $idrProduct->id)));
        $this->assertSame(0, count(array_filter($dashboard->json('data.topProducts'), fn ($p) => $p['productId'] === $product->id)));
        // Daftar order terbaru tetap memuat order USD beserta mata uangnya.
        $this->assertContains('USD', array_column($dashboard->json('data.recentOrders'), 'currency'));

        // Dashboard customer ekspor menghitung dalam USD.
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->getJson('/api/v1/customer/dashboard')->assertOk()
            ->assertJsonPath('data.currency', 'USD')->assertJsonPath('data.transactionValue', 127500)->assertJsonPath('data.totalOrders', 1);
    }

    public function test_usd_order_mails_format_amounts_in_usd_with_swift_details(): void
    {
        $product = $this->setUpExportScenario();
        $order = app(\App\Services\Commerce\CheckoutService::class)->place($this->exporter, $this->exportCheckoutPayload($product, 100));

        $html = (new OrderPlaced($order))->render();
        $this->assertStringContainsString('USD 1,275.00', $html);
        $this->assertStringContainsString('BMRIIDJA', $html);
        $this->assertStringContainsString('(USD)', $html);
        $this->assertStringNotContainsString('Rp ', $html);
        $this->assertStringNotContainsString('Kode unik', $html);
    }

    public function test_local_customer_cannot_use_export_terms_and_keeps_rupiah_flow(): void
    {
        $this->setUpCommerce();
        $this->setUpExport();
        $product = $this->makeProduct(['price' => 100000, 'price_usd' => '7.00'], 100);

        // Customer lokal: term fob ditolak, syarat bayar ekspor ditolak, order IDR biasa tetap jalan (rupiah, kode unik).
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1, ['deliveryTermCode' => 'fob', 'addressId' => null, 'shippingRateId' => null]))
            ->assertStatus(422)->assertJsonValidationErrors(['deliveryTermCode']);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1, ['paymentTermCode' => 'tt_advance']))
            ->assertStatus(422)->assertJsonValidationErrors(['paymentTermCode']);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1, ['bankAccountId' => $this->usdBank->id]))
            ->assertStatus(422)->assertJsonValidationErrors(['bankAccountId']);
        $order = $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($product, 1))->assertStatus(201)
            ->assertJsonPath('data.currency', 'IDR')->assertJsonPath('data.items.0.unitPrice', 100000)->assertJsonPath('data.paymentTerm', null)->assertJsonPath('data.payment.currency', 'IDR');
        $this->assertGreaterThan(0, $order->json('data.uniqueCode'));
        $this->assertDatabaseHas('orders', ['number' => $order->json('data.number'), 'currency' => 'IDR', 'subtotal' => '100000.00']);
    }
}
