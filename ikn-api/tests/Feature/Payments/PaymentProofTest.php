<?php

namespace Tests\Feature\Payments;

use App\Mail\Commerce\PaymentAccepted;
use App\Mail\Commerce\PaymentReceived;
use App\Mail\Commerce\PaymentRejected;
use App\Models\Order;
use App\Models\Payment;
use App\Models\VoucherUsage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Bukti bayar manual (kontrak 9–10, 11.2): upload → review → accept/reject → upload ulang; akses berkas privat; ganti metode.
class PaymentProofTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    private function proofUrl(Order $order): string
    {
        return '/api/v1/customer/orders/'.$order->number.'/proof';
    }

    public function test_reject_then_reupload_creates_new_payment_and_accept_pays_order(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $this->makeVoucher(['code' => 'IKN10']);
        $order = $this->placeOrder($product, 4, ['voucherCode' => 'IKN10']);
        $firstPaymentId = $order->payments()->first()->id;
        $paymentsAdmin = $this->adminWith(['payments'], ['email' => 'pay-admin@ptikn.com']);
        $this->adminWith(['orders'], ['email' => 'order-admin@ptikn.com']);

        // 1. Upload bukti → payment awaiting_verification, order payment_review, email admin payments.
        $upload = $this->actingAs($this->buyer)->post($this->proofUrl($order), ['file' => UploadedFile::fake()->image('bukti.jpg', 800, 600)], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.order.number', $order->number)
            ->assertJsonPath('data.order.status', 'payment_review')
            ->assertJsonPath('data.order.paymentStatus', 'awaiting_verification')
            ->assertJsonPath('data.payment.id', $firstPaymentId)
            ->assertJsonPath('data.payment.status', 'awaiting_verification')
            ->assertJsonPath('data.payment.proof.originalName', 'bukti.jpg')
            ->assertJsonPath('data.payment.proof.mime', 'image/jpeg');
        $mediaId = $upload->json('data.payment.proof.mediaId');
        $this->assertSame('private', \App\Models\Media::find($mediaId)->disk);
        Storage::disk('private')->assertExists(\App\Models\Media::find($mediaId)->path);
        Mail::assertQueued(PaymentReceived::class, fn ($mail) => $mail->hasTo('pay-admin@ptikn.com'));
        Mail::assertNotQueued(PaymentReceived::class, fn ($mail) => $mail->hasTo('order-admin@ptikn.com'));

        // Upload lagi saat masih review → 409 PAYMENT_ALREADY_ACTIVE.
        $this->actingAs($this->buyer)->post($this->proofUrl($order), ['file' => $this->proofFile()], ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('code', 'PAYMENT_ALREADY_ACTIVE')->assertJsonPath('meta.paymentId', $firstPaymentId);

        // 2. Admin reject → payment rejected + alasan, order pending_payment, batas waktu tidak berubah, email customer.
        $dueBefore = $order->fresh()->payment_due_at;
        $this->actingAs($paymentsAdmin)->postJson('/api/v1/admin/payments/'.$firstPaymentId.'/reject', [])->assertStatus(422)->assertJsonValidationErrors(['reason']);
        $this->actingAs($paymentsAdmin)->postJson('/api/v1/admin/payments/'.$firstPaymentId.'/reject', ['reason' => 'Nominal tidak sesuai'])
            ->assertOk()
            ->assertJsonPath('data.payment.status', 'rejected')
            ->assertJsonPath('data.payment.rejectReason', 'Nominal tidak sesuai')
            ->assertJsonPath('data.payment.verifiedBy.id', $paymentsAdmin->id)
            ->assertJsonPath('data.order.status', 'pending_payment')
            ->assertJsonPath('data.order.paymentStatus', 'rejected');
        $this->assertTrue($order->fresh()->payment_due_at->equalTo($dueBefore));
        Mail::assertQueued(PaymentRejected::class, fn ($mail) => $mail->hasTo('buyer@coatingsolutions.co.id') && $mail->reason === 'Nominal tidak sesuai');
        $this->assertDatabaseHas('audit_logs', ['user_id' => $paymentsAdmin->id, 'subject_type' => 'Payment', 'subject_id' => $firstPaymentId]);
        $this->assertSame(4, $product->fresh()->reserved_qty); // reservasi tetap
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$order->number)->assertOk()->assertJsonPath('data.canUploadProof', true)->assertJsonPath('data.activePayment', null);

        // 3. Upload ulang → payment BARU (id baru), yang lama tetap rejected.
        $reupload = $this->actingAs($this->buyer)->post($this->proofUrl($order), ['file' => $this->proofFile('bukti2.pdf')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.order.status', 'payment_review');
        $secondPaymentId = $reupload->json('data.payment.id');
        $this->assertNotSame($firstPaymentId, $secondPaymentId);
        $this->assertSame('rejected', Payment::find($firstPaymentId)->status);
        $this->assertSame('manual_transfer', Payment::find($secondPaymentId)->method);
        $this->assertSame($this->bank->id, Payment::find($secondPaymentId)->bank_account_id);
        $this->assertSame($order->number.'-'.$secondPaymentId, Payment::find($secondPaymentId)->external_id);

        // 4. Accept → paid + commit stok + voucher + invoice + email.
        $accept = $this->actingAs($paymentsAdmin)->postJson('/api/v1/admin/payments/'.$secondPaymentId.'/accept')->assertOk();
        $accept->assertJsonPath('data.payment.status', 'paid')
            ->assertJsonPath('data.payment.verifiedBy.id', $paymentsAdmin->id)
            ->assertJsonPath('data.order.status', 'paid');
        $this->assertMatchesRegularExpression('/^INV\/\d{4}\/\d{2}\/00001$/', $accept->json('data.order.invoiceNumber'));
        $this->assertNotNull($accept->json('data.order.paidAt'));
        $order->refresh();
        $this->assertSame('paid', $order->payment_status);
        $product->refresh();
        $this->assertSame([6, 0, 6], [$product->stock_qty, $product->reserved_qty, $product->available]);
        $this->assertDatabaseHas('stock_movements', ['idempotency_key' => "order:{$order->id}:commit:{$product->id}", 'qty' => -4]);
        $this->assertDatabaseHas('voucher_usages', ['order_id' => $order->id, 'status' => VoucherUsage::STATUS_COMMITTED]);
        Mail::assertQueued(PaymentAccepted::class, fn ($mail) => $mail->hasTo('buyer@coatingsolutions.co.id'));

        // Accept dua kali → 409.
        $this->actingAs($paymentsAdmin)->postJson('/api/v1/admin/payments/'.$secondPaymentId.'/accept')
            ->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION')->assertJsonPath('meta.from', 'paid')->assertJsonPath('meta.to', 'paid');

        // Ledger konsisten.
        app(\App\Services\Stock\StockLedger::class)->rebuild();
        $this->assertSame([6, 0], [$product->fresh()->stock_qty, $product->fresh()->reserved_qty]);
    }

    public function test_alias_by_order_number_and_admin_payment_list(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $a = $this->placeOrder($product, 1);
        $b = $this->placeOrder($product, 1);
        $this->uploadProof($a);
        $this->uploadProof($b);
        $admin = $this->adminWith(['payments']);

        $this->actingAs($admin)->getJson('/api/v1/admin/payments')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.status', 'awaiting_verification')
            ->assertJsonPath('data.0.order.customer.company', 'Coating Solutions Co.')
            ->assertJsonStructure(['data' => [['id', 'method', 'status', 'amount', 'proofUrl', 'proof' => ['mediaId', 'url'], 'order' => ['number', 'grandTotal', 'paymentDueAt', 'customer' => ['name', 'company', 'email']]]]]);
        $this->actingAs($admin)->getJson('/api/v1/admin/payments?q='.$a->number)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.order.number', $a->number);
        $this->actingAs($admin)->getJson('/api/v1/admin/payments?status=paid')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/payments?status=all')->assertOk()->assertJsonCount(2, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/payments?method=qris_static')->assertOk()->assertJsonCount(0, 'data');

        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$a->number.'/payments/reject', ['reason' => 'blur'])
            ->assertOk()->assertJsonPath('data.order.status', 'pending_payment')->assertJsonPath('data.payment.status', 'rejected');
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$b->number.'/payments/accept')
            ->assertOk()->assertJsonPath('data.order.status', 'paid');
        // Alias tanpa payment aktif → 409.
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$a->number.'/payments/accept')->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION');

        $detail = $this->actingAs($admin)->getJson('/api/v1/admin/payments/'.$b->payments()->first()->id)->assertOk();
        $detail->assertJsonPath('data.status', 'paid')->assertJsonPath('data.order.number', $b->number);
        $this->assertStringContainsString('/api/v1/files/', $detail->json('data.proofUrl'));

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['orders']))->getJson('/api/v1/admin/payments')->assertStatus(403);
    }

    public function test_proof_validation_mime_size_and_private_file_access(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $order = $this->placeOrder($product, 1);

        $this->actingAs($this->buyer)->post($this->proofUrl($order), [], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors(['file']);
        $this->actingAs($this->buyer)->post($this->proofUrl($order), ['file' => UploadedFile::fake()->create('virus.exe', 10, 'application/x-msdownload')], ['Accept' => 'application/json'])
            ->assertStatus(415)->assertJsonPath('code', 'UNSUPPORTED_MEDIA_TYPE');
        $this->actingAs($this->buyer)->post($this->proofUrl($order), ['file' => UploadedFile::fake()->create('besar.pdf', 6000, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['file']);
        $this->actingAs($this->buyer)->post($this->proofUrl($order), ['file' => $this->proofFile(), 'paymentId' => 999999], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['paymentId']);
        $this->assertSame('pending_payment', $order->fresh()->status);

        $mediaId = $this->actingAs($this->buyer)->post($this->proofUrl($order), ['file' => $this->proofFile()], ['Accept' => 'application/json'])
            ->assertOk()->json('data.payment.proof.mediaId');

        // Pemilik dan admin boleh mengunduh; customer lain dan tamu tidak.
        $this->actingAs($this->buyer)->get('/api/v1/files/'.$mediaId)->assertOk();
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['payments']))->get('/api/v1/files/'.$mediaId)->assertOk();
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->customer(['email' => 'lain@example.com']))->get('/api/v1/files/'.$mediaId)->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/files/'.$mediaId)->assertStatus(401);

        // Order lain milik pemilik tidak bisa memakai paymentId order ini.
        $other = $this->placeOrder($product, 1);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->buyer)->post($this->proofUrl($other), ['file' => $this->proofFile(), 'paymentId' => $order->payments()->first()->id], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['paymentId']);
    }

    public function test_payment_status_follows_active_payment_after_switching_to_qris_and_uploading_proof(): void
    {
        $this->setUpCommerce();
        $this->makePaymentMethod('qris_static', ['name' => ['id' => 'QRIS']]);
        $product = $this->makeProduct([], 10);
        $order = $this->placeOrder($product, 1);
        $firstId = $order->payments()->first()->id;

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/payments', ['paymentMethodCode' => 'qris_static'])
            ->assertStatus(201)->assertJsonPath('data.order.paymentStatus', 'pending');
        $this->assertSame('cancelled', Payment::find($firstId)->status);

        $this->actingAs($this->buyer)->post($this->proofUrl($order), ['file' => $this->proofFile()], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.order.status', 'payment_review')
            ->assertJsonPath('data.order.paymentStatus', 'awaiting_verification')
            ->assertJsonPath('data.payment.method', 'qris_static');

        // Invarian 7.1: payment_status = status payment terbaru (bukan payment lama yang dibatalkan).
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$order->number)
            ->assertOk()
            ->assertJsonPath('data.status', 'payment_review')
            ->assertJsonPath('data.paymentStatus', 'awaiting_verification')
            ->assertJsonPath('data.activePayment.method', 'qris_static')
            ->assertJsonPath('data.activePayment.status', 'awaiting_verification')
            ->assertJsonPath('data.payments.0.status', 'cancelled')
            ->assertJsonPath('data.payments.1.status', 'awaiting_verification');
        $this->assertSame('awaiting_verification', $order->fresh()->payment_status);
    }

    public function test_switch_payment_method_recalculates_unique_code_and_rejects_when_review_pending(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct(['price' => 100000], 10);
        $qris = $this->makePaymentMethod('qris_static', ['name' => ['id' => 'QRIS']]);
        $order = $this->placeOrder($product, 1);
        $firstId = $order->payments()->first()->id;
        $this->assertGreaterThan(0, $order->unique_code);
        $base = $order->grandTotalBeforeUniqueCode();

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$order->number.'/payments')->assertOk()->assertJsonCount(1, 'data');

        // Ganti ke QRIS: payment manual pending lama dibatalkan, kode unik 0, grand_total turun.
        $switch = $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/payments', ['paymentMethodCode' => 'qris_static'])
            ->assertStatus(201)
            ->assertJsonPath('data.payment.method', 'qris_static')
            ->assertJsonPath('data.payment.status', 'pending')
            ->assertJsonPath('data.payment.amount', $base)
            ->assertJsonPath('data.payment.bankAccount', null)
            ->assertJsonPath('data.order.uniqueCode', 0)
            ->assertJsonPath('data.order.grandTotal', $base)
            ->assertJsonPath('data.order.paymentStatus', 'pending')
            ->assertJsonCount(2, 'data.order.payments');
        $this->assertSame('cancelled', Payment::find($firstId)->status);
        $secondId = $switch->json('data.payment.id');

        // Kembali ke transfer manual: kode unik baru, rekening dipilih.
        $back = $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/payments', ['paymentMethodCode' => 'manual_transfer', 'bankAccountId' => $this->bank->id])
            ->assertStatus(201)->assertJsonPath('data.payment.bankAccount.accountNumber', '0123456789');
        $code = $back->json('data.order.uniqueCode');
        $this->assertGreaterThan(0, $code);
        $this->assertSame($base + $code, $back->json('data.order.grandTotal'));
        $this->assertSame($base + $code, $back->json('data.payment.amount'));
        $this->assertSame('cancelled', Payment::find($secondId)->status);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/payments', ['paymentMethodCode' => 'tidak_ada'])
            ->assertStatus(422)->assertJsonValidationErrors(['paymentMethodCode']);

        // Setelah bukti diunggah → 409 PAYMENT_ALREADY_ACTIVE.
        $this->uploadProof($order);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/payments', ['paymentMethodCode' => 'qris_static'])
            ->assertStatus(409)->assertJsonPath('code', 'PAYMENT_ALREADY_ACTIVE');
        $this->assertSame('awaiting_verification', $order->fresh()->payment_status);
    }
}
