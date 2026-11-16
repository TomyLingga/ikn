<?php

namespace Tests\Feature\Commerce;

use App\Exceptions\ApiException;
use App\Mail\Commerce\InstallmentDue;
use App\Mail\Commerce\InstallmentPaid;
use App\Mail\Commerce\InstallmentReminder;
use App\Mail\Commerce\OrderPlaced;
use App\Mail\Commerce\PaymentAccepted;
use App\Mail\Commerce\PaymentReceived;
use App\Mail\Commerce\PaymentRejected;
use App\Models\Order;
use App\Models\OrderInstallment;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\PaymentTerm;
use App\Models\Product;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\Commerce\CheckoutService;
use App\Services\Commerce\FreightQuoteService;
use App\Services\Commerce\InstallmentService;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Payment\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

/**
 * Pembayaran bertahap / termin (ASUMSI A-97, kontrak 9, 10, 11.2, 11.10, 11.13). Syarat tt_30_70 dari migrasi berjadwal
 * 30% saat pesanan dibuat + 70% saat dikirim (jatuh tempo 14 hari). Order uji: 33 kg × USD 10,01 = USD 330,33
 * (33.033 sen) agar pembagian tidak bulat: uang muka 9.910 sen, pelunasan 23.123 sen.
 */
class InstallmentTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    private const TOTAL = 33033;
    private const DOWN = 9910;
    private const BALANCE = 23123;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function setUpTermin(array $settings = []): Product
    {
        $this->setUpCommerce(array_merge(['exportPaymentDueHours' => 120, 'autoCompleteDays' => 7], $settings));
        $this->setUpExport();

        return $this->makeProduct(['slug' => 'resiprene-35', 'code' => 'RSP-35', 'price' => 185000, 'price_usd' => '10.01', 'moq' => 1, 'unit' => 'kg'], 5000);
    }

    private function terminOrder(Product $product, int $qty = 33, string $term = 'tt_30_70'): Order
    {
        return app(CheckoutService::class)->place($this->exporter, $this->exportCheckoutPayload($product, $qty, ['paymentTermCode' => $term]));
    }

    /** Render email dengan mailer asli (Mail::fake mengganti mailer sehingga Mailable::render() tidak tersedia). */
    private function renderMail(Mailable $mail): string
    {
        $this->app->instance('mailer', (new MailManager($this->app))->mailer());
        try {
            return $mail->render();
        } finally {
            $this->app->forgetInstance('mailer');
        }
    }

    /** Ganti pengguna yang login di tengah test (guard menyimpan user sebelumnya). */
    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function row(Order $order, int $seq): OrderInstallment
    {
        return OrderInstallment::where('order_id', $order->id)->where('seq', $seq)->firstOrFail();
    }

    /** Uang muka: unggah bukti + verifikasi → order paid. */
    private function payDown(Order $order, ?User $admin = null): Order
    {
        $payments = app(PaymentService::class);
        $payment = $payments->uploadProof($order, $this->proofFile(), null, $this->exporter);
        $payments->accept($payment, $admin ?? $this->superAdmin());

        return $order->fresh();
    }

    private function ship(Order $order, ?User $admin = null): Order
    {
        $sm = app(OrderStateMachine::class);
        $admin = $admin ?? $this->superAdmin();
        if ($order->status === Order::STATUS_PAID) {
            $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        }
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['vesselName' => 'MV Kota Bahagia', 'blNumber' => 'BLW-PKG-2026-0001']);

        return $order->fresh();
    }

    /** Pelunasan: unggah bukti + verifikasi. */
    private function payBalance(Order $order, ?User $admin = null): Order
    {
        $payments = app(PaymentService::class);
        $payment = $payments->uploadProof($order, $this->proofFile('pelunasan.pdf'), null, $this->exporter);
        $payments->accept($payment, $admin ?? $this->superAdmin());

        return $order->fresh();
    }

    // ------------------------------------------------------------------ jadwal di syarat pembayaran

    public function test_payment_term_schedule_is_validated_normalized_and_published(): void
    {
        $admin = $this->adminWith(['payment_methods']);
        $base = ['code' => 'tt_20_30_50', 'name' => ['id' => 'T/T 20/30/50', 'en' => 'T/T 20/30/50']];
        $row = fn (float $percent, string $trigger, array $extra = []) => ['label' => ['id' => "Termin $percent%"], 'percent' => $percent, 'trigger' => $trigger] + $extra;

        // Bawaan migrasi: tt_30_70 berjadwal, tt_advance tidak.
        $this->actingAs($admin)->getJson('/api/v1/admin/payment-terms')->assertOk()
            ->assertJsonPath('data.0.code', 'tt_advance')->assertJsonPath('data.0.installments', [])
            ->assertJsonPath('data.1.code', 'tt_30_70')->assertJsonCount(2, 'data.1.installments')
            ->assertJsonPath('data.1.installments.0', ['key' => 'down_payment', 'label' => ['id' => 'Uang muka 30%', 'en' => '30% down payment'], 'percent' => 30, 'trigger' => 'order', 'dueDays' => 0])
            ->assertJsonPath('data.1.installments.1.percent', 70)->assertJsonPath('data.1.installments.1.trigger', 'shipped')->assertJsonPath('data.1.installments.1.dueDays', 14);

        $post = fn (array $installments, array $extra = []) => $this->actingAs($admin)->postJson('/api/v1/admin/payment-terms', $base + $extra + ['installments' => $installments]);

        // Jumlah persen harus tepat 100.
        $post([$row(30, 'order'), $row(60, 'shipped')])->assertStatus(422)->assertJsonValidationErrors(['installments']);
        // Baris pertama harus ditagih saat pesanan dibuat.
        $post([$row(30, 'shipped'), $row(70, 'delivered')])->assertStatus(422)->assertJsonValidationErrors(['installments']);
        // Paling banyak 6 baris.
        $post(array_merge([$row(10, 'order')], array_fill(0, 5, $row(10, 'shipped')), [$row(40, 'delivered')]))->assertStatus(422)->assertJsonValidationErrors(['installments']);
        // Key unik.
        $post([$row(30, 'order', ['key' => 'dp']), $row(70, 'shipped', ['key' => 'dp'])])->assertStatus(422)->assertJsonValidationErrors(['installments']);
        // Aturan per baris: persen > 0 dan ≤ 100 dengan 2 desimal, pemicu dikenal, hari ≥ 0, label wajib.
        $post([$row(0, 'order'), $row(100, 'shipped')])->assertStatus(422)->assertJsonValidationErrors(['installments.0.percent']);
        $post([$row(33.333, 'order'), $row(66.667, 'shipped')])->assertStatus(422)->assertJsonValidationErrors(['installments.0.percent']);
        $post([$row(30, 'order'), $row(70, 'paid')])->assertStatus(422)->assertJsonValidationErrors(['installments.1.trigger']);
        $post([$row(30, 'order'), $row(70, 'shipped', ['dueDays' => -1])])->assertStatus(422)->assertJsonValidationErrors(['installments.1.dueDays']);
        $post([['percent' => 30, 'trigger' => 'order'], $row(70, 'shipped')])->assertStatus(422)->assertJsonValidationErrors(['installments.0.label']);
        // Jadwal hanya untuk syarat pasar ekspor.
        $post([$row(30, 'order'), $row(70, 'shipped')], ['market' => 'local'])->assertStatus(422)->assertJsonValidationErrors(['installments']);
        $this->assertSame(2, PaymentTerm::count());

        // Sah: key dibuat dari label, hari baris pertama selalu 0, en diisi dari id.
        $created = $post([$row(20, 'order', ['dueDays' => 5]), $row(30, 'shipped', ['dueDays' => 7, 'key' => 'On-Board']), $row(50, 'delivered', ['dueDays' => 30])])->assertCreated();
        $created->assertJsonCount(3, 'data.installments')
            ->assertJsonPath('data.installments.0.key', 'termin_20')->assertJsonPath('data.installments.0.dueDays', 0)->assertJsonPath('data.installments.0.label.en', 'Termin 20%')
            ->assertJsonPath('data.installments.1.key', 'on_board')->assertJsonPath('data.installments.1.dueDays', 7)
            ->assertJsonPath('data.installments.2.trigger', 'delivered')->assertJsonPath('data.installments.2.percent', 50);
        $id = $created->json('data.id');

        // PUT tanpa installments mempertahankan jadwal; pindah ke pasar lokal ditolak selagi berjadwal.
        $this->actingAs($admin)->putJson("/api/v1/admin/payment-terms/$id", ['name' => $base['name'], 'sortOrder' => 5])->assertOk()->assertJsonCount(3, 'data.installments');
        $this->actingAs($admin)->putJson("/api/v1/admin/payment-terms/$id", ['name' => $base['name'], 'market' => 'local'])->assertStatus(422)->assertJsonValidationErrors(['installments']);
        // Satu baris 100% sama dengan bayar penuh: disimpan tanpa jadwal; [] juga mengosongkan.
        $this->actingAs($admin)->putJson("/api/v1/admin/payment-terms/$id", ['name' => $base['name'], 'installments' => [$row(100, 'order')]])->assertOk()->assertJsonPath('data.installments', []);
        $this->assertNull(PaymentTerm::findOrFail($id)->getRawOriginal('installments'));
        $this->actingAs($admin)->putJson("/api/v1/admin/payment-terms/$id", ['name' => $base['name'], 'installments' => [$row(50, 'order'), $row(50, 'delivered', ['dueDays' => 3])]])->assertOk()->assertJsonCount(2, 'data.installments');
        $this->actingAs($admin)->putJson("/api/v1/admin/payment-terms/$id", ['name' => $base['name'], 'installments' => []])->assertOk()->assertJsonPath('data.installments', []);

        // Publik: jadwal ikut di GET /commerce/config untuk customer ekspor.
        $this->setUpCommerce();
        $this->setUpExport();
        $config = $this->as($this->exporter)->getJson('/api/v1/commerce/config')->assertOk();
        $terms = collect($config->json('data.paymentTerms'))->keyBy('code');
        $this->assertSame([], $terms['tt_advance']['installments']);
        $this->assertSame(['order', 'shipped'], array_column($terms['tt_30_70']['installments'], 'trigger'));
    }

    // ------------------------------------------------------------------ checkout

    public function test_checkout_creates_installments_and_bills_only_the_first_one(): void
    {
        Mail::fake();
        $product = $this->setUpTermin();
        Carbon::setTestNow(Carbon::parse('2026-11-16 09:00:00', config('app.timezone')));

        // Pratinjau di quote: nominal dari grand total, jumlahnya tepat total.
        $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => $product->slug, 'qty' => 33]], 'paymentMethodCode' => 'manual_transfer', 'paymentTermCode' => 'tt_30_70',
        ])->assertOk()->assertJsonPath('data.grandTotal', self::TOTAL)
            ->assertJsonPath('data.paymentTerm.installments.1.percent', 70)
            ->assertJsonPath('data.installments.0.amount', self::DOWN)->assertJsonPath('data.installments.0.trigger', 'order')
            ->assertJsonPath('data.installments.1.amount', self::BALANCE)->assertJsonPath('data.installments.1.dueDays', 14);
        $this->actingAs($this->exporter)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 33]], 'paymentTermCode' => 'tt_advance'])
            ->assertOk()->assertJsonPath('data.installments', []);

        $response = $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders', $this->exportCheckoutPayload($product, 33, ['paymentTermCode' => 'tt_30_70']))->assertStatus(201);
        $order = Order::where('number', $response->json('data.number'))->firstOrFail();

        $response->assertJsonPath('data.status', 'pending_payment')->assertJsonPath('data.grandTotal', self::TOTAL)
            ->assertJsonPath('data.paymentDueAt', '2026-11-21T09:00:00+07:00')
            ->assertJsonPath('data.paymentTerm.code', 'tt_30_70')->assertJsonCount(2, 'data.paymentTerm.installments')
            // Payment pertama = termin pertama, bukan grand total.
            ->assertJsonPath('data.payment.amount', self::DOWN)->assertJsonPath('data.payment.installment.seq', 1)
            ->assertJsonPath('data.payment.installment.label.en', '30% down payment')->assertJsonPath('data.payment.expiresAt', '2026-11-21T09:00:00+07:00')
            ->assertJsonCount(2, 'data.installments')
            ->assertJsonPath('data.installments.0.seq', 1)->assertJsonPath('data.installments.0.key', 'down_payment')->assertJsonPath('data.installments.0.percent', 30)
            ->assertJsonPath('data.installments.0.amount', self::DOWN)->assertJsonPath('data.installments.0.currency', 'USD')
            ->assertJsonPath('data.installments.0.status', 'due')->assertJsonPath('data.installments.0.overdue', false)
            ->assertJsonPath('data.installments.0.dueAt', '2026-11-21T09:00:00+07:00')->assertJsonPath('data.installments.0.billedAt', '2026-11-16T09:00:00+07:00')
            ->assertJsonPath('data.installments.0.activePayment.amount', self::DOWN)->assertJsonCount(1, 'data.installments.0.payments')
            ->assertJsonPath('data.installments.0.canUploadProof', true)->assertJsonPath('data.installments.0.canBill', false)
            ->assertJsonPath('data.installments.1.seq', 2)->assertJsonPath('data.installments.1.amount', self::BALANCE)->assertJsonPath('data.installments.1.status', 'scheduled')
            ->assertJsonPath('data.installments.1.trigger', 'shipped')->assertJsonPath('data.installments.1.dueDays', 14)->assertJsonPath('data.installments.1.dueAt', null)
            ->assertJsonPath('data.installments.1.payments', [])->assertJsonPath('data.installments.1.canUploadProof', false)->assertJsonPath('data.installments.1.canBill', false)
            ->assertJsonPath('data.paymentProgress', ['currency' => 'USD', 'paidTotal' => 0, 'outstandingTotal' => self::TOTAL, 'status' => 'unpaid']);

        $this->assertSame(self::TOTAL, OrderInstallment::where('order_id', $order->id)->get()->sum(fn (OrderInstallment $row) => $row->amountInt()));
        $this->assertDatabaseHas('order_installments', ['order_id' => $order->id, 'seq' => 1, 'amount' => '99.10', 'percent' => '30.00', 'currency' => 'USD', 'status' => 'due']);
        $this->assertDatabaseHas('order_installments', ['order_id' => $order->id, 'seq' => 2, 'amount' => '231.23', 'percent' => '70.00', 'status' => 'scheduled', 'due_days' => 14]);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'installment_id' => $this->row($order, 1)->id, 'amount' => '99.10', 'status' => 'pending']);
        $this->assertSame(1, $order->payments()->count());
        $this->assertSame(['order', 'shipped'], array_column($order->payment_term_snapshot['installments'], 'trigger'));

        // Email pesanan menyebut nominal yang ditagih sekarang dan jadwalnya.
        Mail::assertQueued(OrderPlaced::class, 1);
        $html = $this->renderMail(new OrderPlaced($order->fresh()));
        $this->assertStringContainsString('USD 99.10', $html);
        $this->assertStringContainsString('30% down payment', $html);
        $this->assertStringContainsString('70% balance', $html);
        $this->assertStringContainsString('USD 231.23', $html);
        // Order USD tanpa kode unik: teks metode transfer (ditulis untuk rupiah) diganti teks tetap tanpa kode unik.
        $this->assertStringNotContainsString('Transfer to the account below.', $html);
        $this->assertStringContainsString(__('commerce.mail.placed.instructions_foreign', [], 'en'), $html);
        $this->assertStringNotContainsString('unique code', $html);

        // Ganti rekening sebelum bayar: payment baru tetap senilai termin pertama dan milik termin pertama.
        $other = \App\Models\BankAccount::create(['bank_name' => 'Bank BNI', 'account_number' => '0099', 'account_holder' => 'PT Industri Karet Nusantara', 'currency' => 'USD', 'is_active' => true]);
        $this->actingAs($this->exporter)->postJson("/api/v1/customer/orders/{$order->number}/payments", ['paymentMethodCode' => 'manual_transfer', 'bankAccountId' => $other->id])
            ->assertStatus(201)->assertJsonPath('data.payment.amount', self::DOWN)->assertJsonPath('data.payment.installment.seq', 1)
            ->assertJsonPath('data.order.grandTotal', self::TOTAL)->assertJsonCount(2, 'data.order.installments.0.payments');
        $this->assertSame(2, OrderInstallment::where('order_id', $order->id)->count());

        // Daftar order customer: ringkasan kemajuan pembayaran.
        $this->actingAs($this->exporter)->getJson('/api/v1/customer/orders')->assertOk()
            ->assertJsonPath('data.0.paymentProgress.status', 'unpaid')->assertJsonPath('data.0.hasInstallments', true)->assertJsonPath('data.0.nextInstallment', null);
    }

    public function test_cif_acceptance_creates_installments_from_the_final_total(): void
    {
        Mail::fake();
        $product = $this->setUpTermin();
        $admin = $this->superAdmin();
        $order = app(CheckoutService::class)->place($this->exporter, $this->exportCheckoutPayload($product, 33, [
            'deliveryTermCode' => 'cif', 'paymentTermCode' => 'tt_30_70',
            'destinationPort' => ['name' => 'Port Klang', 'country' => 'Malaysia', 'countryCode' => 'MY', 'lat' => 2.9997, 'lng' => 101.3929],
        ]));

        // Menunggu penawaran ongkir: total belum final, belum ada termin maupun payment.
        $this->assertSame(Order::STATUS_AWAITING_FREIGHT, $order->status);
        $this->assertSame(0, OrderInstallment::where('order_id', $order->id)->count());
        $this->assertSame(0, $order->payments()->count());
        $this->actingAs($this->exporter)->getJson("/api/v1/customer/orders/{$order->number}")->assertOk()
            ->assertJsonPath('data.installments', [])->assertJsonPath('data.paymentProgress.status', 'unpaid')->assertJsonPath('data.paymentProgress.outstandingTotal', self::TOTAL);

        $quotes = app(FreightQuoteService::class);
        $quote = $quotes->adminPropose($order, $admin, [['label' => 'Ocean freight', 'amount' => 10001]]);
        $order = $quotes->customerAccept($order, $this->exporter, $quote);

        // 33.033 + 10.001 = 43.034 sen; 30% = 12.910,2 → 12.910; sisa 30.124.
        $this->assertSame(Order::STATUS_PENDING_PAYMENT, $order->status);
        $this->assertSame(43034, $order->grandTotalInt());
        $rows = OrderInstallment::where('order_id', $order->id)->orderBy('seq')->get();
        $this->assertSame([12910, 30124], $rows->map(fn (OrderInstallment $row) => $row->amountInt())->all());
        $this->assertSame(['due', 'scheduled'], $rows->pluck('status')->all());
        $this->assertTrue($rows[0]->due_at->equalTo($order->payment_due_at));
        $payment = $order->payments()->firstOrFail();
        $this->assertSame(12910, $payment->amountInt());
        $this->assertSame($rows[0]->id, (int) $payment->installment_id);
        $this->assertSame(1, $order->payments()->count());
    }

    // ------------------------------------------------------------------ alur penuh

    public function test_first_installment_pays_the_order_shipping_bills_the_balance_and_its_proof_does_not_change_order_status(): void
    {
        Mail::fake();
        $product = $this->setUpTermin();
        $admin = $this->adminWith(['orders', 'payments']);
        Carbon::setTestNow(Carbon::parse('2026-11-16 09:00:00', config('app.timezone')));
        $order = $this->terminOrder($product);
        $number = $order->number;
        $proofUrl = "/api/v1/customer/orders/$number/proof";

        // 1. Uang muka: bukti → payment_review, termin pertama awaiting_verification; lonceng admin menyebut terminnya.
        $down = $this->as($this->exporter)->post($proofUrl, ['file' => $this->proofFile()], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.order.status', 'payment_review')->assertJsonPath('data.payment.amount', self::DOWN)->assertJsonPath('data.payment.installment.seq', 1);
        $this->assertSame('awaiting_verification', $this->row($order, 1)->status);
        $bell = UserNotification::where('user_id', $admin->id)->where('type', 'admin.payment_proof_installment')->firstOrFail();
        $this->assertStringContainsString('Uang muka 30%', $bell->body['id']);
        $this->assertStringContainsString('30% down payment', $bell->body['en']);
        Mail::assertQueued(PaymentReceived::class, fn (PaymentReceived $mail) => str_contains($this->renderMail($mail), 'Uang muka 30%'));

        // 2. Verifikasi uang muka → order paid lewat jalur biasa, kemajuan "partial", pelunasan belum ditagih.
        $this->as($admin)->postJson('/api/v1/admin/payments/'.$down->json('data.payment.id').'/accept', ['receivedAmount' => self::DOWN])->assertOk()
            ->assertJsonPath('data.order.status', 'paid')->assertJsonPath('data.order.paymentProgress.status', 'partial')
            ->assertJsonPath('data.payment.installment.status', 'paid');
        $detail = $this->as($admin)->getJson("/api/v1/admin/orders/$number")->assertOk();
        $detail->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.installments.0.status', 'paid')->assertJsonPath('data.installments.0.paidAt', '2026-11-16T09:00:00+07:00')
            ->assertJsonPath('data.installments.1.status', 'scheduled')->assertJsonPath('data.installments.1.canBill', true)->assertJsonPath('data.installments.1.canRemind', false)
            ->assertJsonPath('data.paymentProgress', ['currency' => 'USD', 'paidTotal' => self::DOWN, 'outstandingTotal' => self::BALANCE, 'status' => 'partial'])
            ->assertJsonPath('data.canComplete', false);
        $this->assertNotNull($order->fresh()->invoice_number);
        Mail::assertQueued(PaymentAccepted::class, fn (PaymentAccepted $mail) => str_contains($this->renderMail($mail), 'The remaining balance follows the schedule below'));
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.installment_paid')->count());
        Mail::assertNotQueued(InstallmentDue::class);

        // 3. Dikirim (dimuat ke kapal) → pelunasan ditagih: due, jatuh tempo +14 hari, payment baru, email + lonceng.
        Carbon::setTestNow(Carbon::parse('2026-11-20 10:00:00', config('app.timezone')));
        $statusUrl = "/api/v1/admin/orders/$number/status";
        $this->as($admin)->postJson($statusUrl, ['status' => 'processing'])->assertOk()->assertJsonPath('data.installments.1.status', 'scheduled');
        $shipped = $this->as($admin)->postJson($statusUrl, ['status' => 'shipped', 'vesselName' => 'MV Kota Bahagia', 'blNumber' => 'BLW-PKG-2026-0001'])->assertOk();
        $shipped->assertJsonPath('data.status', 'shipped')
            ->assertJsonPath('data.installments.1.status', 'due')->assertJsonPath('data.installments.1.overdue', false)
            ->assertJsonPath('data.installments.1.billedAt', '2026-11-20T10:00:00+07:00')->assertJsonPath('data.installments.1.dueAt', '2026-12-04T10:00:00+07:00')
            ->assertJsonPath('data.installments.1.activePayment.amount', self::BALANCE)->assertJsonPath('data.installments.1.activePayment.status', 'pending')
            ->assertJsonPath('data.installments.1.activePayment.bankAccount.currency', 'USD')
            ->assertJsonPath('data.installments.1.canChangeDue', true)->assertJsonPath('data.installments.1.canRemind', true)->assertJsonPath('data.installments.1.canBill', false)
            ->assertJsonPath('data.paymentStatus', 'pending')->assertJsonCount(2, 'data.payments');
        $balance = $this->row($order, 2);
        Mail::assertQueued(InstallmentDue::class, fn (InstallmentDue $mail) => $mail->installment->is($balance) && str_contains($this->renderMail($mail), 'USD 231.23') && str_contains($this->renderMail($mail), '70% balance'));
        $dueBell = UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.installment_due')->firstOrFail();
        $this->assertStringContainsString('Pelunasan 70%', $dueBell->body['id']);
        $this->assertStringContainsString('USD 231.23', $dueBell->body['en']);

        // Customer melihat termin yang bisa dibayar; canUploadProof order (alur lama) tetap false.
        $this->as($this->exporter)->getJson("/api/v1/customer/orders/$number")->assertOk()
            ->assertJsonPath('data.canUploadProof', false)->assertJsonPath('data.installments.1.canUploadProof', true)->assertJsonPath('data.installments.0.canUploadProof', false);
        $this->as($this->exporter)->getJson('/api/v1/customer/orders')->assertOk()
            ->assertJsonPath('data.0.paymentProgress.status', 'partial')->assertJsonPath('data.0.nextInstallment.seq', 2)->assertJsonPath('data.0.nextInstallment.amount', self::BALANCE);

        // 4. Bukti pelunasan: status order tetap shipped, termin awaiting_verification, admin diberi tahu.
        $this->as($this->exporter)->post($proofUrl, ['file' => $this->proofFile(), 'installmentId' => 999999], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['installmentId']);
        $proof = $this->as($this->exporter)->post($proofUrl, ['file' => $this->proofFile('pelunasan.pdf'), 'installmentId' => $balance->id], ['Accept' => 'application/json'])->assertOk();
        $proof->assertJsonPath('data.order.status', 'shipped')->assertJsonPath('data.order.paymentStatus', 'awaiting_verification')
            ->assertJsonPath('data.payment.amount', self::BALANCE)->assertJsonPath('data.payment.status', 'awaiting_verification')->assertJsonPath('data.payment.installment.seq', 2);
        $paymentId = $proof->json('data.payment.id');
        $this->assertSame('awaiting_verification', $balance->fresh()->status);
        $this->assertSame('shipped', $order->fresh()->status);
        $this->assertSame(0, $order->histories()->where('to_status', 'payment_review')->where('created_at', '>=', now())->count());
        $this->assertSame(1, UserNotification::where('user_id', $admin->id)->where('type', 'admin.payment_proof_installment')->get()->filter(fn ($n) => str_contains($n->body['id'], 'Pelunasan 70%'))->count());
        // Bukti kedua selagi menunggu verifikasi → 409.
        $this->as($this->exporter)->post($proofUrl, ['file' => $this->proofFile(), 'installmentId' => $balance->id], ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('code', 'PAYMENT_ALREADY_ACTIVE');

        // Daftar pembayaran admin memuat label termin dan kemajuan order.
        $this->as($admin)->getJson('/api/v1/admin/payments')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $paymentId)->assertJsonPath('data.0.installment.label.id', 'Pelunasan 70%')->assertJsonPath('data.0.installment.seq', 2)
            ->assertJsonPath('data.0.amount', self::BALANCE)->assertJsonPath('data.0.order.paymentProgress.status', 'partial')->assertJsonPath('data.0.order.status', 'shipped');

        // 5. Ditolak → termin kembali ditagih, customer diberi tahu, unggah ulang membuat payment baru untuk termin itu.
        $this->as($admin)->postJson("/api/v1/admin/payments/$paymentId/reject", ['reason' => 'Nominal kurang'])->assertOk()
            ->assertJsonPath('data.payment.status', 'rejected')->assertJsonPath('data.order.status', 'shipped');
        $this->assertSame('due', $balance->fresh()->status);
        $this->assertTrue($balance->fresh()->due_at->equalTo(Carbon::parse('2026-12-04 10:00:00', config('app.timezone'))));
        Mail::assertQueued(PaymentRejected::class, fn (PaymentRejected $mail) => str_contains($this->renderMail($mail), '70% balance') && str_contains($this->renderMail($mail), 'Nominal kurang'));
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.installment_rejected')->count());

        $retry = $this->as($this->exporter)->post($proofUrl, ['file' => $this->proofFile('pelunasan-2.pdf')], ['Accept' => 'application/json'])->assertOk();
        $retryId = $retry->json('data.payment.id');
        $this->assertNotSame($paymentId, $retryId);
        $retry->assertJsonPath('data.payment.installment.seq', 2)->assertJsonPath('data.payment.amount', self::BALANCE)->assertJsonPath('data.order.status', 'shipped');
        $this->assertSame(2, Payment::where('installment_id', $balance->id)->count());

        // 6. Verifikasi pelunasan (jumlah diterima + biaya bank tetap dicatat) → lunas penuh, status order tetap.
        Carbon::setTestNow(Carbon::parse('2026-11-25 14:00:00', config('app.timezone')));
        $this->as($admin)->postJson("/api/v1/admin/payments/$retryId/accept", ['receivedAmount' => self::BALANCE - 2500, 'bankCharges' => 2500, 'receivedNote' => 'Correspondent bank fee'])->assertOk()
            ->assertJsonPath('data.payment.status', 'paid')->assertJsonPath('data.payment.receivedAmount', self::BALANCE - 2500)->assertJsonPath('data.payment.bankCharges', 2500)
            ->assertJsonPath('data.order.status', 'shipped')->assertJsonPath('data.order.paymentProgress.status', 'paid');
        $final = $this->as($admin)->getJson("/api/v1/admin/orders/$number")->assertOk();
        $final->assertJsonPath('data.status', 'shipped')->assertJsonPath('data.paymentStatus', 'paid')
            ->assertJsonPath('data.installments.1.status', 'paid')->assertJsonPath('data.installments.1.paidAt', '2026-11-25T14:00:00+07:00')
            ->assertJsonCount(2, 'data.installments.1.payments')->assertJsonPath('data.installments.1.activePayment', null)
            ->assertJsonPath('data.paymentProgress', ['currency' => 'USD', 'paidTotal' => self::TOTAL, 'outstandingTotal' => 0, 'status' => 'paid']);
        Mail::assertQueued(InstallmentPaid::class, fn (InstallmentPaid $mail) => $mail->fullyPaid && str_contains($this->renderMail($mail), 'fully paid'));
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.fully_paid')->count());
        // paid_at dan nomor invoice order tetap dari termin pertama (pendapatan dihitung sekali).
        $this->assertTrue($order->fresh()->paid_at->equalTo(Carbon::parse('2026-11-16 09:00:00', config('app.timezone'))));
        $this->assertSame(1, $order->histories()->where('to_status', 'paid')->count());

        // 7. Lunas → boleh diterima lalu diselesaikan.
        $this->as($this->exporter)->postJson("/api/v1/customer/orders/$number/confirm-received")->assertOk()->assertJsonPath('data.status', 'delivered')->assertJsonPath('data.canComplete', true);
        $this->as($this->exporter)->postJson("/api/v1/customer/orders/$number/complete")->assertOk()->assertJsonPath('data.status', 'completed');
        $this->assertSame(3, $order->payments()->count());
    }

    // ------------------------------------------------------------------ gating selesai

    public function test_order_cannot_be_completed_by_anyone_while_an_installment_is_unpaid(): void
    {
        Mail::fake();
        $product = $this->setUpTermin(['autoCompleteDays' => 7]);
        $admin = $this->adminWith(['orders', 'payments']);
        $order = $this->ship($this->payDown($this->terminOrder($product)));
        app(OrderStateMachine::class)->transition($order, Order::STATUS_DELIVERED, $admin);
        $number = $order->number;

        // Transisi lain tidak terhalang: order sampai delivered dengan pelunasan masih ditagih.
        $this->assertSame('delivered', $order->fresh()->status);
        $this->assertSame('due', $this->row($order, 2)->status);

        // Notifikasi dan email "diterima" tidak mengajak customer menyelesaikan pesanan selagi pelunasan belum lunas.
        $delivered = UserNotification::where('user_id', $this->exporter->id)->where('type', 'like', 'order.%delivered%')->latest('id')->firstOrFail();
        $this->assertSame('order.delivered_balance_due', $delivered->type);
        $this->assertStringContainsString('USD 231.23', $delivered->body['en']);
        $deliveredMail = $this->renderMail(new \App\Mail\Commerce\OrderDelivered($order->fresh(), 7));
        $this->assertStringContainsString('USD 231.23', $deliveredMail);
        $this->assertStringNotContainsString('completed automatically', $deliveredMail);

        // Customer.
        $this->as($this->exporter)->getJson("/api/v1/customer/orders/$number")->assertOk()->assertJsonPath('data.canComplete', false);
        $this->as($this->exporter)->postJson("/api/v1/customer/orders/$number/complete")->assertStatus(409)
            ->assertJsonPath('code', 'INSTALLMENTS_UNPAID')->assertJsonPath('meta.outstandingTotal', self::BALANCE)->assertJsonPath('meta.currency', 'USD');
        // Admin.
        $this->as($admin)->postJson("/api/v1/admin/orders/$number/status", ['status' => 'completed'])->assertStatus(409)->assertJsonPath('code', 'INSTALLMENTS_UNPAID');
        // Selesai otomatis: order dilewati, dan pintu state machine juga menolak pemicu sistem.
        Carbon::setTestNow(now()->addDays(30));
        $this->artisan('orders:auto-complete')->expectsOutput('0 order(s) auto-completed.')->assertExitCode(0);
        try {
            app(OrderStateMachine::class)->transition($order->fresh(), Order::STATUS_COMPLETED, null, ['actorType' => OrderStatusHistory::ACTOR_SYSTEM, 'days' => 7]);
            $this->fail('completed must be rejected while the balance is unpaid');
        } catch (ApiException $e) {
            $this->assertSame('INSTALLMENTS_UNPAID', $e->errorCode);
            $this->assertSame(409, $e->status);
        }
        $this->assertSame('delivered', $order->fresh()->status);
        $this->assertNull($order->fresh()->completed_at);

        // Bukti menunggu verifikasi masih dihitung belum lunas.
        $payment = app(PaymentService::class)->uploadProof($order->fresh(), $this->proofFile(), null, $this->exporter);
        $this->as($this->exporter)->postJson("/api/v1/customer/orders/$number/complete")->assertStatus(409)->assertJsonPath('code', 'INSTALLMENTS_UNPAID');

        // Setelah lunas: selesai otomatis berjalan.
        app(PaymentService::class)->accept($payment, $admin);
        $this->artisan('orders:auto-complete')->expectsOutput('1 order(s) auto-completed.')->assertExitCode(0);
        $this->assertSame('completed', $order->fresh()->status);
    }

    // ------------------------------------------------------------------ batal dan kedaluwarsa

    public function test_cancelling_or_expiring_an_order_voids_its_unpaid_installments(): void
    {
        Mail::fake();
        $product = $this->setUpTermin(['exportPaymentDueHours' => 24]);
        $admin = $this->adminWith(['orders', 'payments']);
        $sm = app(OrderStateMachine::class);

        // Batal oleh admin setelah uang muka lunas dan pelunasan ditagih lebih awal: termin lunas tetap, sisanya void.
        $paid = $this->payDown($this->terminOrder($product));
        app(InstallmentService::class)->bill($paid, $this->row($paid, 2), null, $admin);
        $this->assertSame('pending', $paid->fresh()->payment_status);
        $this->as($admin)->postJson("/api/v1/admin/orders/{$paid->number}/cancel", ['reason' => 'Kapal dibatalkan'])->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.installments.0.status', 'paid')->assertJsonPath('data.installments.1.status', 'void')
            ->assertJsonPath('data.installments.1.canUploadProof', false)->assertJsonPath('data.installments.1.canRemind', false)
            ->assertJsonPath('data.paymentProgress', ['currency' => 'USD', 'paidTotal' => self::DOWN, 'outstandingTotal' => 0, 'status' => 'partial']);
        $this->assertSame(Payment::STATUS_CANCELLED, Payment::where('installment_id', $this->row($paid, 2)->id)->value('status'));
        // Termin void tidak bisa ditagih, diingatkan, atau dibayar.
        $this->as($admin)->postJson("/api/v1/admin/orders/{$paid->number}/installments/{$this->row($paid, 2)->id}/bill")->assertStatus(409)->assertJsonPath('code', 'INSTALLMENT_NOT_BILLABLE');
        $this->as($admin)->postJson("/api/v1/admin/orders/{$paid->number}/installments/{$this->row($paid, 2)->id}/remind")->assertStatus(409)->assertJsonPath('code', 'INSTALLMENT_NOT_DUE');
        $this->as($this->exporter)->post("/api/v1/customer/orders/{$paid->number}/proof", ['file' => $this->proofFile(), 'installmentId' => $this->row($paid, 2)->id], ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('code', 'INSTALLMENT_NOT_DUE');

        // Batal oleh customer sebelum bayar: semua termin void.
        $unpaid = $this->terminOrder($product);
        $sm->transition($unpaid, Order::STATUS_CANCELLED, $this->exporter, ['reason' => 'Changed plan']);
        $this->assertSame(['void', 'void'], OrderInstallment::where('order_id', $unpaid->id)->orderBy('seq')->pluck('status')->all());
        $this->assertSame('unpaid', $unpaid->fresh()->paymentProgress()['status']);
        $this->assertSame(0, $unpaid->fresh()->paymentProgress()['outstandingTotal']);

        // Kedaluwarsa hanya dari batas bayar termin pertama (orders:expire): termin ikut void.
        $late = $this->terminOrder($product);
        Carbon::setTestNow(now()->addHours(25));
        $this->artisan('orders:expire')->assertExitCode(0);
        $this->assertSame('expired', $late->fresh()->status);
        $this->assertSame(['void', 'void'], OrderInstallment::where('order_id', $late->id)->orderBy('seq')->pluck('status')->all());
    }

    public function test_later_installments_never_expire_the_order_they_only_become_overdue(): void
    {
        Mail::fake();
        $product = $this->setUpTermin(['exportPaymentDueHours' => 24]);
        $admin = $this->adminWith(['orders', 'payments']);
        Carbon::setTestNow(Carbon::parse('2026-11-16 09:00:00', config('app.timezone')));
        $order = $this->ship($this->payDown($this->terminOrder($product)));

        Carbon::setTestNow(Carbon::parse('2026-12-20 09:00:00', config('app.timezone'))); // 20 hari setelah jatuh tempo
        $this->artisan('orders:expire')->expectsOutput('0 order(s) expired, 0 skipped.')->assertExitCode(0);
        $this->assertSame('shipped', $order->fresh()->status);
        $this->as($admin)->getJson("/api/v1/admin/orders/{$order->number}")->assertOk()
            ->assertJsonPath('data.installments.1.status', 'due')->assertJsonPath('data.installments.1.overdue', true)->assertJsonPath('data.installments.1.canUploadProof', true);
        $this->as($admin)->getJson('/api/v1/admin/orders?installments=overdue')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.nextInstallment.overdue', true);

        // Termin terlambat tetap bisa dibayar.
        $this->as($this->exporter)->post("/api/v1/customer/orders/{$order->number}/proof", ['file' => $this->proofFile()], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.payment.installment.seq', 2)->assertJsonPath('data.order.status', 'shipped');
    }

    // ------------------------------------------------------------------ order tanpa termin

    public function test_single_payment_orders_behave_as_before(): void
    {
        Mail::fake();
        $product = $this->setUpTermin();
        $admin = $this->superAdmin();

        // USD 100% di muka: tanpa baris termin, payment = grand total.
        $usd = $this->terminOrder($product, 33, 'tt_advance');
        $this->assertSame(0, OrderInstallment::where('order_id', $usd->id)->count());
        $this->assertSame(self::TOTAL, $usd->payments()->firstOrFail()->amountInt());
        $this->assertNull($usd->payments()->firstOrFail()->installment_id);
        $this->as($this->exporter)->getJson("/api/v1/customer/orders/{$usd->number}")->assertOk()
            ->assertJsonPath('data.installments', [])->assertJsonPath('data.payment.installment', null)->assertJsonPath('data.payment.amount', self::TOTAL)
            ->assertJsonPath('data.paymentProgress', ['currency' => 'USD', 'paidTotal' => 0, 'outstandingTotal' => self::TOTAL, 'status' => 'unpaid']);
        $this->as($this->exporter)->post("/api/v1/customer/orders/{$usd->number}/proof", ['file' => $this->proofFile(), 'installmentId' => 1], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['installmentId']);
        $usd = $this->ship($this->payDown($usd, $admin), $admin);
        $this->assertSame(1, $usd->payments()->count()); // dikirim tidak menagih apa pun
        Mail::assertNotQueued(InstallmentDue::class);
        $this->assertSame(['currency' => 'USD', 'paidTotal' => self::TOTAL, 'outstandingTotal' => 0, 'status' => 'paid'], $usd->paymentProgress());
        $this->as($this->exporter)->postJson("/api/v1/customer/orders/{$usd->number}/confirm-received")->assertOk();
        $this->as($this->exporter)->postJson("/api/v1/customer/orders/{$usd->number}/complete")->assertOk()->assertJsonPath('data.status', 'completed');

        // Order rupiah: alur lama dengan kode unik, satu payment sebesar grand total.
        $idrProduct = $this->makeProduct(['price' => 100000], 100);
        $idr = $this->placeOrder($idrProduct, 2);
        $this->assertSame(0, OrderInstallment::where('order_id', $idr->id)->count());
        $this->assertSame($idr->grandTotalInt(), $idr->payments()->firstOrFail()->amountInt());
        $this->as($this->buyer)->getJson("/api/v1/customer/orders/{$idr->number}")->assertOk()
            ->assertJsonPath('data.installments', [])->assertJsonPath('data.paymentProgress.status', 'unpaid')->assertJsonPath('data.paymentProgress.currency', 'IDR')
            ->assertJsonPath('data.canUploadProof', true);
        $idr = $this->payOrder($idr, $admin);
        $this->assertSame('paid', $idr->status);
        $this->assertSame('paid', $idr->paymentProgress()['status']);
        $this->as($admin)->getJson('/api/v1/admin/orders?installments=partial')->assertOk()->assertJsonCount(0, 'data');
        $this->as($admin)->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.outstandingInstallments', [])->assertJsonPath('data.workQueue.installmentsDue', 0);

        // Order lama yang dibuat sebelum syaratnya diberi jadwal tidak ikut berubah.
        $this->assertSame([], $usd->fresh()->paymentTerm()['installments']);
    }

    // ------------------------------------------------------------------ tagih, ubah jatuh tempo, pengingat

    public function test_admin_can_bill_early_change_the_due_date_and_remind_with_a_rate_limit(): void
    {
        Mail::fake();
        $product = $this->setUpTermin();
        $paymentsAdmin = $this->adminWith(['payments']);
        $ordersAdmin = $this->adminWith(['orders']);
        Carbon::setTestNow(Carbon::parse('2026-11-16 09:00:00', config('app.timezone')));
        $order = $this->terminOrder($product);
        $other = $this->terminOrder($product);
        $balance = $this->row($order, 2);
        $url = fn (OrderInstallment $row, string $action, ?Order $of = null) => '/api/v1/admin/orders/'.($of ?? $order)->number."/installments/{$row->id}/$action";

        // Otorisasi: modul payments (seperti verifikasi pembayaran); customer dan tamu ditolak.
        $this->postJson($url($balance, 'bill'))->assertStatus(401);
        $this->as($this->exporter)->postJson($url($balance, 'bill'))->assertStatus(403);
        $this->as($ordersAdmin)->postJson($url($balance, 'bill'))->assertStatus(403);
        $this->as($ordersAdmin)->postJson($url($balance, 'remind'))->assertStatus(403);

        // Sebelum uang muka lunas termin lanjutan belum bisa ditagih; termin pertama tidak pernah lewat endpoint ini.
        $this->as($paymentsAdmin)->postJson($url($balance, 'bill'))->assertStatus(409)->assertJsonPath('code', 'INSTALLMENT_NOT_BILLABLE')->assertJsonPath('meta.orderStatus', 'pending_payment');
        $this->as($paymentsAdmin)->postJson($url($balance, 'remind'))->assertStatus(409)->assertJsonPath('code', 'INSTALLMENT_NOT_DUE');
        $order = $this->payDown($order);
        $this->as($paymentsAdmin)->postJson($url($this->row($order, 1), 'bill'))->assertStatus(409)->assertJsonPath('code', 'INSTALLMENT_NOT_BILLABLE');
        // Termin milik order lain → 404.
        $this->as($paymentsAdmin)->postJson($url($this->row($other, 2), 'bill'))->assertStatus(404);
        $this->as($paymentsAdmin)->postJson($url($balance, 'bill'), ['dueAt' => '2026-11-10T09:00:00+07:00'])->assertStatus(422)->assertJsonValidationErrors(['dueAt']);
        $this->assertSame('scheduled', $balance->fresh()->status);
        Mail::assertNotQueued(InstallmentDue::class);

        // Tagih lebih awal tanpa tanggal: jatuh tempo sekarang + dueDays jadwal (14 hari).
        $billed = $this->as($paymentsAdmin)->postJson($url($balance, 'bill'))->assertOk();
        $billed->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.installments.1.status', 'due')->assertJsonPath('data.installments.1.dueAt', '2026-11-30T09:00:00+07:00')
            ->assertJsonPath('data.installments.1.activePayment.amount', self::BALANCE)->assertJsonPath('data.installments.1.activePayment.expiresAt', '2026-11-30T09:00:00+07:00');
        Mail::assertQueued(InstallmentDue::class, 1);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $paymentsAdmin->id, 'action' => 'installment.billed', 'subject_type' => 'OrderInstallment', 'subject_id' => $balance->id]);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $paymentsAdmin->id, 'action' => 'POST api/v1/admin/orders/{order}/installments/{installment}/bill']);

        // Sudah ditagih: tanpa dueAt 409, dengan dueAt mengubah jatuh tempo tanpa payment baru.
        $this->as($paymentsAdmin)->postJson($url($balance, 'bill'))->assertStatus(409)->assertJsonPath('code', 'INSTALLMENT_ALREADY_BILLED');
        $this->as($paymentsAdmin)->postJson($url($balance, 'bill'), ['dueAt' => '2026-12-15T17:00:00+07:00'])->assertOk()
            ->assertJsonPath('data.installments.1.dueAt', '2026-12-15T17:00:00+07:00')->assertJsonPath('data.installments.1.activePayment.expiresAt', '2026-12-15T17:00:00+07:00')
            ->assertJsonCount(1, 'data.installments.1.payments');
        Mail::assertQueued(InstallmentDue::class, 1);
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.installment_due_changed')->count());

        // Dikirim setelah ditagih lebih awal: tidak menagih ulang.
        $this->ship($order);
        $this->assertSame(1, Payment::where('installment_id', $balance->id)->count());
        Mail::assertQueued(InstallmentDue::class, 1);
        $this->assertTrue($balance->fresh()->due_at->equalTo(Carbon::parse('2026-12-15 17:00:00', config('app.timezone'))));

        // Pengingat: sekali per 12 jam.
        $this->as($paymentsAdmin)->postJson($url($balance, 'remind'))->assertOk()
            ->assertJsonPath('data.installments.1.reminderCount', 1)->assertJsonPath('data.installments.1.remindedAt', '2026-11-16T09:00:00+07:00');
        Mail::assertQueued(InstallmentReminder::class, fn (InstallmentReminder $mail) => ! $mail->overdue && str_contains($this->renderMail($mail), 'has not been paid yet'));
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.installment_reminder')->count());
        Carbon::setTestNow(Carbon::parse('2026-11-16 20:59:00', config('app.timezone')));
        $this->as($paymentsAdmin)->postJson($url($balance, 'remind'))->assertStatus(409)
            ->assertJsonPath('code', 'INSTALLMENT_REMINDER_TOO_SOON')->assertJsonPath('meta.retryAt', '2026-11-16T21:00:00+07:00');
        Mail::assertQueued(InstallmentReminder::class, 1);
        Carbon::setTestNow(Carbon::parse('2026-11-16 21:00:00', config('app.timezone')));
        $this->as($paymentsAdmin)->postJson($url($balance, 'remind'))->assertOk()->assertJsonPath('data.installments.1.reminderCount', 2);
        Mail::assertQueued(InstallmentReminder::class, 2);

        // Terlambat: pengingat memakai teks "melewati jatuh tempo".
        Carbon::setTestNow(Carbon::parse('2026-12-16 09:00:00', config('app.timezone')));
        $this->as($paymentsAdmin)->postJson($url($balance, 'remind'))->assertOk();
        Mail::assertQueued(InstallmentReminder::class, fn (InstallmentReminder $mail) => $mail->overdue && str_contains($this->renderMail($mail), 'Please complete the payment as soon as possible'));
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.installment_overdue')->count());

        // Lunas: tidak bisa ditagih atau diingatkan lagi.
        $this->payBalance($order);
        $this->as($paymentsAdmin)->postJson($url($balance, 'remind'))->assertStatus(409)->assertJsonPath('code', 'INSTALLMENT_NOT_DUE');
        $this->as($paymentsAdmin)->postJson($url($balance, 'bill'), ['dueAt' => '2027-01-15T17:00:00+07:00'])->assertStatus(409)->assertJsonPath('code', 'INSTALLMENT_NOT_BILLABLE');
    }

    public function test_racing_requests_never_bill_or_pay_an_installment_twice(): void
    {
        Mail::fake();
        $product = $this->setUpTermin();
        $admin = $this->superAdmin();
        $service = app(InstallmentService::class);
        $payments = app(PaymentService::class);
        $order = $this->payDown($this->terminOrder($product));

        // Dua permintaan "Tagih" memegang salinan termin yang sama (status scheduled). Yang kedua membaca ulang baris
        // di bawah kunci FOR UPDATE dan ditolak; hanya satu payment yang dibuat.
        $first = $this->row($order, 2);
        $second = $this->row($order, 2);
        $service->bill($order, $first, null, $admin);
        try {
            $service->bill($order, $second, null, $admin);
            $this->fail('the second bill request must be rejected');
        } catch (ApiException $e) {
            $this->assertSame('INSTALLMENT_ALREADY_BILLED', $e->errorCode);
        }
        $this->assertSame(1, Payment::where('installment_id', $first->id)->count());
        Mail::assertQueued(InstallmentDue::class, 1);

        // Transisi dikirim (pemicu otomatis) setelah ditagih manual, juga dari salinan order yang basi.
        $staleOrder = Order::findOrFail($order->id);
        $this->ship($order, $admin);
        $this->assertSame([], $service->onTransition($staleOrder, Order::STATUS_PROCESSING, Order::STATUS_SHIPPED, $admin));
        $this->assertSame(1, Payment::where('installment_id', $first->id)->count());
        Mail::assertQueued(InstallmentDue::class, 1);

        // Dua unggahan bukti bersamaan untuk payment yang sama: yang kedua 409, termin tidak berubah dua kali.
        $payment = Payment::where('installment_id', $first->id)->firstOrFail();
        $staleA = Payment::findOrFail($payment->id);
        $staleB = Payment::findOrFail($payment->id);
        $payments->attachProof($order->fresh(), $staleA, $this->proofMedia(), $this->exporter);
        try {
            $payments->attachProof($order->fresh(), $staleB, $this->proofMedia(), $this->exporter);
            $this->fail('the second proof must be rejected');
        } catch (ApiException $e) {
            $this->assertSame('PAYMENT_ALREADY_ACTIVE', $e->errorCode);
        }

        // Dua verifikasi bersamaan: yang kedua 409 INVALID_TRANSITION, termin lunas sekali.
        $payments->accept($staleA, $admin);
        try {
            $payments->accept($staleB, $admin);
            $this->fail('the second accept must be rejected');
        } catch (ApiException $e) {
            $this->assertSame('INVALID_TRANSITION', $e->errorCode);
        }
        $this->assertSame('paid', $first->fresh()->status);
        Mail::assertQueued(InstallmentPaid::class, 1);
        $this->assertSame(self::TOTAL, $order->fresh()->paymentProgress()['paidTotal']);
    }

    public function test_installment_reminder_command_is_idempotent(): void
    {
        Mail::fake();
        $product = $this->setUpTermin();
        $this->commerceSettings(['installmentRemindBeforeDays' => 3, 'installmentRemindOverdueDays' => 3]);
        $tz = config('app.timezone');
        Carbon::setTestNow(Carbon::parse('2026-11-16 09:00:00', $tz));
        $order = $this->ship($this->payDown($this->terminOrder($product))); // pelunasan jatuh tempo 2026-11-30 09:00
        $unpaidFirst = $this->terminOrder($product); // termin pertama diurus orders:remind, bukan perintah ini
        $balance = $this->row($order, 2);
        $run = fn (string $expected) => $this->artisan('orders:installment-remind')->expectsOutput($expected)->assertExitCode(0);

        // Masih jauh dari jatuh tempo.
        Carbon::setTestNow(Carbon::parse('2026-11-26 09:00:00', $tz));
        $run('0 reminder(s) sent before due, 0 overdue.');

        // Tiga hari sebelum jatuh tempo: sekali, lalu tidak lagi walau dijalankan ulang atau keesokan harinya.
        Carbon::setTestNow(Carbon::parse('2026-11-27 09:00:00', $tz));
        $run('1 reminder(s) sent before due, 0 overdue.');
        $run('0 reminder(s) sent before due, 0 overdue.');
        Carbon::setTestNow(Carbon::parse('2026-11-28 09:00:00', $tz));
        $run('0 reminder(s) sent before due, 0 overdue.');
        $this->assertSame(1, $balance->fresh()->reminder_count);
        Mail::assertQueued(InstallmentReminder::class, 1);

        // Terlambat: pengingat tiap 3 hari sejak pengingat terakhir.
        Carbon::setTestNow(Carbon::parse('2026-11-30 10:00:00', $tz));
        $run('0 reminder(s) sent before due, 1 overdue.');
        $run('0 reminder(s) sent before due, 0 overdue.');
        Carbon::setTestNow(Carbon::parse('2026-12-02 10:00:00', $tz));
        $run('0 reminder(s) sent before due, 0 overdue.');
        Carbon::setTestNow(Carbon::parse('2026-12-03 10:00:00', $tz));
        $run('0 reminder(s) sent before due, 1 overdue.');
        $this->assertSame(3, $balance->fresh()->reminder_count);
        Mail::assertQueued(InstallmentReminder::class, 3);
        $this->assertSame(1, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.installment_reminder')->count());
        $this->assertSame(2, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.installment_overdue')->count());
        // Order tidak pernah dibatalkan karena termin lanjutan terlambat.
        $this->assertSame('shipped', $order->fresh()->status);

        // Setting 0 mematikan pengingat; bukti yang menunggu verifikasi dan termin lunas tidak diingatkan.
        Carbon::setTestNow(Carbon::parse('2026-12-10 10:00:00', $tz));
        $this->commerceSettings(['installmentRemindOverdueDays' => 0]);
        $run('0 reminder(s) sent before due, 0 overdue.');
        $this->commerceSettings(['installmentRemindOverdueDays' => 3]);
        app(PaymentService::class)->uploadProof($order->fresh(), $this->proofFile(), null, $this->exporter);
        $run('0 reminder(s) sent before due, 0 overdue.');
        Mail::assertQueued(InstallmentReminder::class, 3);
        $this->assertSame('pending_payment', $unpaidFirst->fresh()->status);
        $this->assertSame(0, $this->row($unpaidFirst, 1)->reminder_count);
    }

    // ------------------------------------------------------------------ daftar dan dashboard admin

    public function test_admin_lists_and_dashboard_show_partially_paid_orders_and_outstanding_installments(): void
    {
        Mail::fake();
        $product = $this->setUpTermin();
        $admin = $this->superAdmin();
        Carbon::setTestNow(Carbon::parse('2026-11-16 09:00:00', config('app.timezone')));

        $scheduled = $this->payDown($this->terminOrder($product), $admin); // uang muka lunas, pelunasan belum ditagih
        $due = $this->ship($this->payDown($this->terminOrder($product), $admin), $admin); // pelunasan ditagih
        $settled = $this->payBalance($this->ship($this->payDown($this->terminOrder($product), $admin), $admin), $admin); // lunas penuh
        $this->terminOrder($product); // belum bayar sama sekali
        $this->terminOrder($product, 33, 'tt_advance');

        $partial = $this->as($admin)->getJson('/api/v1/admin/orders?installments=partial')->assertOk()->assertJsonCount(2, 'data');
        $this->assertEqualsCanonicalizing([$scheduled->number, $due->number], array_column($partial->json('data'), 'number'));
        $this->assertSame(['partial', 'partial'], array_column(array_column($partial->json('data'), 'paymentProgress'), 'status'));
        $this->as($admin)->getJson('/api/v1/admin/orders?installments=due')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.number', $due->number)->assertJsonPath('data.0.nextInstallment.label.id', 'Pelunasan 70%')->assertJsonPath('data.0.nextInstallment.dueAt', '2026-11-30T09:00:00+07:00');
        $this->as($admin)->getJson('/api/v1/admin/orders?installments=overdue')->assertOk()->assertJsonCount(0, 'data');
        $this->as($admin)->getJson('/api/v1/admin/orders?installments=semua')->assertStatus(422);
        $this->as($admin)->getJson('/api/v1/admin/orders?status=all')->assertOk()->assertJsonCount(5, 'data');
        $this->assertSame('paid', $settled->paymentProgress()['status']);

        $dashboard = $this->as($admin)->getJson('/api/v1/admin/dashboard')->assertOk();
        $dashboard->assertJsonPath('data.workQueue.installmentsDue', 1)
            ->assertJsonPath('data.outstandingInstallments', [['currency' => 'USD', 'total' => self::BALANCE * 2, 'count' => 2, 'overdue' => 0]])
            // Pendapatan tetap menghitung order penuh sejak termin pertama diverifikasi (tiga order dibayar).
            ->assertJsonPath('data.exportKpis.revenue', self::TOTAL * 3)->assertJsonPath('data.exportKpis.paidOrders', 3);
        // Admin tanpa modul payments tidak mendapat penghitung antrean termin.
        $this->as($this->adminWith(['dashboard', 'orders']))->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.workQueue.installmentsDue', null);

        Carbon::setTestNow(Carbon::parse('2026-12-05 09:00:00', config('app.timezone')));
        $this->as($admin)->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.outstandingInstallments.0.overdue', 1)->assertJsonPath('data.workQueue.installmentsDue', 1);
        $this->as($admin)->getJson('/api/v1/admin/orders?installments=overdue')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.number', $due->number);
    }
}
