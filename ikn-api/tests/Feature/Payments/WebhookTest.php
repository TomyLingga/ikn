<?php

namespace Tests\Feature\Payments;

use App\Mail\Commerce\PaymentAccepted;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\PaymentWebhookLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// POST /payments/webhook/{provider} (kontrak bagian 10): signature, idempotensi provider+external_id+event, efek sekali.
class WebhookTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    private const TOKEN = 'test-callback-token';

    /** Order dengan payment xendit (QRIS dinamis) yang dibuat lewat Http::fake. */
    private function gatewayOrder(): Order
    {
        config(['ikn.gateways.xendit.secret_key' => 'xnd_test_secret', 'ikn.gateways.xendit.callback_token' => self::TOKEN]);
        Http::fake(['api.xendit.co/qr_codes' => Http::response(['id' => 'qr_123', 'qr_string' => '000201...', 'status' => 'ACTIVE'], 201)]);
        $qris = $this->makePaymentMethod('qris_dynamic', ['type' => PaymentMethod::TYPE_QRIS_DYNAMIC, 'driver' => PaymentMethod::DRIVER_XENDIT, 'config' => ['channelCode' => 'QRIS']]);
        $product = $this->makeProduct([], 10);

        return $this->placeOrder($product, 2, ['paymentMethodCode' => $qris->code]);
    }

    private function payload(Order $order, Payment $payment, string $status = 'SUCCEEDED', ?int $amount = null): array
    {
        return [
            'id' => 'qr_123', 'external_id' => $payment->external_id, 'status' => $status,
            'amount' => $amount ?? $payment->amountInt(), 'paid_at' => '2026-09-21T03:00:00Z',
        ];
    }

    public function test_duplicate_webhook_is_processed_once_and_pays_the_order(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $order = $this->gatewayOrder();
        $payment = $order->payments()->first();
        $this->assertSame('xendit', $payment->provider);
        $this->assertSame($order->number.'-'.$payment->id, $payment->external_id);
        $this->assertSame('qr_123', $payment->payload['providerId']);
        $product = $order->items()->first()->product;

        $headers = ['x-callback-token' => self::TOKEN]; // tanpa Origin → bukan request stateful Sanctum, tanpa CSRF
        $this->postJson('/api/v1/payments/webhook/xendit', $this->payload($order, $payment), $headers)
            ->assertOk()->assertJsonPath('data.received', true)->assertJsonPath('data.result', 'processed')->assertJsonPath('data.paymentId', $payment->id);

        $order->refresh();
        $this->assertSame('paid', $order->status);
        $this->assertSame('paid', $order->payment_status);
        $this->assertNotNull($order->invoice_number);
        $this->assertSame('2026-09-21T10:00:00+07:00', $order->paid_at->toApiString());
        $this->assertSame(['pending_payment', 'payment_review', 'paid'], $order->histories()->pluck('to_status')->all());
        $this->assertSame(['webhook', 'webhook'], $order->histories()->where('actor_type', 'webhook')->pluck('actor_type')->all());
        $this->assertSame([8, 0], [$product->fresh()->stock_qty, $product->fresh()->reserved_qty]);
        $this->assertDatabaseHas('audit_logs', ['subject_type' => 'Order', 'subject_id' => $order->id, 'action' => 'order.paid [webhook]']);
        Mail::assertQueued(PaymentAccepted::class, 1);

        // Kedua kalinya: duplicate, tanpa efek ganda.
        $this->postJson('/api/v1/payments/webhook/xendit', $this->payload($order, $payment), $headers)
            ->assertOk()->assertJsonPath('data.result', 'duplicate');
        $this->assertSame(1, $order->histories()->where('to_status', 'paid')->count());
        $this->assertSame(1, \App\Models\StockMovement::where('type', 'commit')->count());
        Mail::assertQueued(PaymentAccepted::class, 1);

        $logs = PaymentWebhookLog::orderBy('id')->get();
        $this->assertSame(['processed', 'duplicate'], $logs->pluck('result')->all());
        $this->assertSame([true, true], $logs->pluck('signature_valid')->all());
        $this->assertSame($payment->external_id, $logs[0]->external_id);
        $this->assertSame('succeeded', $logs[0]->event);
        $this->assertSame('***', $logs[0]->headers['x-callback-token']);
        $this->assertSame('SUCCEEDED', $logs[0]->payload['status']);
    }

    public function test_invalid_signature_returns_401_and_is_logged_without_effect(): void
    {
        $this->setUpCommerce();
        $order = $this->gatewayOrder();
        $payment = $order->payments()->first();

        $this->postJson('/api/v1/payments/webhook/xendit', $this->payload($order, $payment), ['x-callback-token' => 'salah'])
            ->assertStatus(401)->assertJsonPath('code', 'WEBHOOK_SIGNATURE_INVALID');
        $this->postJson('/api/v1/payments/webhook/xendit', $this->payload($order, $payment))->assertStatus(401);

        $this->assertSame('pending_payment', $order->fresh()->status);
        $this->assertSame(2, PaymentWebhookLog::where('signature_valid', false)->where('result', 'ignored')->count());

        // Provider tidak dikenal / tanpa webhook → 404.
        $this->postJson('/api/v1/payments/webhook/midtrans', [])->assertStatus(404);
        $this->postJson('/api/v1/payments/webhook/manual', [], ['x-callback-token' => self::TOKEN])->assertStatus(404);
    }

    public function test_amount_mismatch_unknown_payment_and_expired_events(): void
    {
        $this->setUpCommerce();
        $order = $this->gatewayOrder();
        $payment = $order->payments()->first();
        $headers = ['x-callback-token' => self::TOKEN];

        // Nominal tidak cocok → ignored, order tetap pending.
        $this->postJson('/api/v1/payments/webhook/xendit', $this->payload($order, $payment, 'SUCCEEDED', 1), $headers)
            ->assertOk()->assertJsonPath('data.result', 'ignored');
        $this->assertSame('pending_payment', $order->fresh()->status);

        // external_id tidak dikenal → ignored.
        $this->postJson('/api/v1/payments/webhook/xendit', ['external_id' => 'IKN-00000000-00000-1', 'status' => 'SUCCEEDED', 'amount' => 1], $headers)
            ->assertOk()->assertJsonPath('data.result', 'ignored');

        // EXPIRED → payment expired, order tetap pending_payment (customer bisa ganti metode; scheduler yang mengekspirasi order).
        $this->postJson('/api/v1/payments/webhook/xendit', $this->payload($order, $payment, 'EXPIRED'), $headers)
            ->assertOk()->assertJsonPath('data.result', 'processed');
        $this->assertSame('expired', $payment->fresh()->status);
        $order->refresh();
        $this->assertSame('pending_payment', $order->status);
        $this->assertSame('expired', $order->payment_status);

        // SUCCEEDED setelah expired → ignored (payment sudah tidak aktif); status PENDING → ignored.
        $this->postJson('/api/v1/payments/webhook/xendit', $this->payload($order, $payment, 'SUCCEEDED'), $headers)
            ->assertOk()->assertJsonPath('data.result', 'ignored');
        $this->postJson('/api/v1/payments/webhook/xendit', $this->payload($order, $payment, 'PENDING'), $headers)
            ->assertOk()->assertJsonPath('data.result', 'ignored');
        $this->assertSame('pending_payment', $order->fresh()->status);
    }

    public function test_webhook_with_frontend_origin_still_works_without_session(): void
    {
        $this->setUpCommerce();
        $order = $this->gatewayOrder();
        $payment = $order->payments()->first();

        // Request stateful (Origin FE) tanpa sesi/XSRF: hanya untuk memastikan route webhook tidak bergantung pada CSRF FE.
        $this->postJson('/api/v1/payments/webhook/xendit', $this->payload($order, $payment), ['x-callback-token' => self::TOKEN, 'Origin' => 'http://evil.example'])
            ->assertOk()->assertJsonPath('data.result', 'processed');
    }
}
