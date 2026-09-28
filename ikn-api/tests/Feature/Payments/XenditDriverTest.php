<?php

namespace Tests\Feature\Payments;

use App\Exceptions\ApiException;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Services\Payment\Gateway\GatewayManager;
use App\Services\Payment\Gateway\ManualDriver;
use App\Services\Payment\Gateway\XenditDriver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Contract test kerangka XenditDriver (ASUMSI A-15) dengan Http::fake: create/checkStatus/cancel/handleWebhook.
class XenditDriverTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        config(['ikn.gateways.xendit.secret_key' => 'xnd_test_secret', 'ikn.gateways.xendit.callback_token' => 'cb-token', 'ikn.gateways.xendit.base_url' => 'https://api.xendit.co']);
    }

    private function paymentFor(string $type, array $config = []): Payment
    {
        $method = PaymentMethod::where('code', $type)->first()
            ?? $this->makePaymentMethod($type, ['type' => $type, 'driver' => PaymentMethod::DRIVER_XENDIT, 'config' => $config]);
        $product = $this->makeProduct([], 10);
        $order = $this->placeOrder($product, 1, ['paymentMethodCode' => $method->code]);

        return $order->payments()->first();
    }

    public function test_manager_resolves_driver_by_method_and_provider(): void
    {
        $manager = app(GatewayManager::class);
        $this->assertInstanceOf(ManualDriver::class, $manager->for($this->makePaymentMethod('manual_transfer')));
        $this->assertInstanceOf(XenditDriver::class, $manager->driver('xendit'));
        $this->assertSame(['manual', 'xendit'], GatewayManager::providers());

        $this->expectException(ApiException::class);
        $manager->driver('midtrans');
    }

    public function test_create_qris_dynamic_virtual_account_and_ewallet(): void
    {
        $this->setUpCommerce();
        Http::fake([
            'api.xendit.co/qr_codes' => Http::response(['id' => 'qr_1', 'reference_id' => 'x', 'qr_string' => '0002010102', 'status' => 'ACTIVE', 'expires_at' => '2026-09-29T02:00:00Z'], 201),
            'api.xendit.co/callback_virtual_accounts' => Http::response(['id' => 'va_1', 'account_number' => '8808123456', 'bank_code' => 'BCA', 'name' => 'Coating', 'status' => 'PENDING', 'expiration_date' => '2026-09-29T02:00:00Z'], 200),
            'api.xendit.co/ewallets/charges' => Http::response(['id' => 'ewc_1', 'channel_code' => 'ID_OVO', 'status' => 'PENDING', 'actions' => ['desktop_web_checkout_url' => 'https://checkout.example/1']], 201),
        ]);

        $qr = $this->paymentFor(PaymentMethod::TYPE_QRIS_DYNAMIC, ['channelCode' => 'QRIS']);
        $this->assertSame('qr_1', $qr->payload['providerId']);
        $this->assertSame('0002010102', $qr->payload['qrString']);
        $this->assertSame($qr->external_id, $qr->payload['externalId']);
        Http::assertSent(function (Request $request) use ($qr) {
            return $request->url() === 'https://api.xendit.co/qr_codes'
                && $request['reference_id'] === $qr->external_id
                && $request['type'] === 'DYNAMIC'
                && $request['amount'] === $qr->amountInt()
                && $request->hasHeader('Authorization')
                && str_starts_with($request->header('Authorization')[0], 'Basic ')
                && $request->header('api-version')[0] === '2022-07-31';
        });

        $va = $this->paymentFor(PaymentMethod::TYPE_VIRTUAL_ACCOUNT, ['bankCode' => 'BCA']);
        $this->assertSame('va_1', $va->payload['providerId']);
        $this->assertSame('8808123456', $va->payload['accountNumber']);
        Http::assertSent(fn (Request $r) => $r->url() === 'https://api.xendit.co/callback_virtual_accounts' && $r['bank_code'] === 'BCA' && $r['is_closed'] === true && $r['expected_amount'] === $va->amountInt() && $r['external_id'] === $va->external_id);

        $ew = $this->paymentFor(PaymentMethod::TYPE_EWALLET, ['channelCode' => 'ID_OVO']);
        $this->assertSame('ewc_1', $ew->payload['providerId']);
        $this->assertSame('https://checkout.example/1', $ew->payload['checkoutUrl']);
        Http::assertSent(fn (Request $r) => $r->url() === 'https://api.xendit.co/ewallets/charges' && $r['channel_code'] === 'ID_OVO' && $r['checkout_method'] === 'ONE_TIME_PAYMENT' && $r['reference_id'] === $ew->external_id);

        // Semua payment gateway punya external_id unik per provider dan status pending.
        $this->assertSame(3, Payment::where('provider', 'xendit')->where('status', 'pending')->count());
        $this->assertSame(3, Payment::where('provider', 'xendit')->distinct('external_id')->count('external_id'));

        $resource = $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$ew->order->number)->assertOk();
        $resource->assertJsonPath('data.activePayment.gateway.checkoutUrl', 'https://checkout.example/1')->assertJsonPath('data.canUploadProof', false);
    }

    public function test_check_status_and_cancel(): void
    {
        $this->setUpCommerce();
        Http::fake([
            'api.xendit.co/callback_virtual_accounts' => Http::response(['id' => 'va_1', 'account_number' => '8808', 'status' => 'PENDING'], 200),
            'api.xendit.co/callback_virtual_accounts/va_1' => Http::sequence()
                ->push(['id' => 'va_1', 'status' => 'PENDING']) // GET checkStatus
                ->push(['id' => 'va_1', 'status' => 'INACTIVE']) // PATCH cancel
                ->push(['id' => 'va_1', 'status' => 'INACTIVE']), // GET checkStatus
        ]);
        $driver = app(XenditDriver::class);
        $va = $this->paymentFor(PaymentMethod::TYPE_VIRTUAL_ACCOUNT, ['bankCode' => 'BCA']);

        $status = $driver->checkStatus($va);
        $this->assertNull($status['status']);
        $this->assertSame('PENDING', $status['providerStatus']);

        $driver->cancel($va);
        Http::assertSent(fn (Request $r) => $r->method() === 'PATCH' && $r->url() === 'https://api.xendit.co/callback_virtual_accounts/va_1' && isset($r['expiration_date']));

        // Setelah PATCH, status INACTIVE dipetakan ke expired.
        $this->assertSame('expired', $driver->checkStatus($va)['status']);
    }

    public function test_handle_webhook_verifies_token_and_maps_status(): void
    {
        $driver = app(XenditDriver::class);

        $result = $driver->handleWebhook(['x-callback-token' => 'cb-token'], ['id' => 'qr_123', 'external_id' => 'IKN-20260921-00043-51', 'status' => 'SUCCEEDED', 'amount' => 16805217, 'paid_at' => '2026-09-21T03:00:00Z']);
        $this->assertSame('IKN-20260921-00043-51', $result->externalId);
        $this->assertSame('paid', $result->status);
        $this->assertSame('succeeded', $result->event);
        $this->assertSame(16805217, $result->amount);
        $this->assertSame('qr_123', $result->providerId);
        $this->assertTrue($result->signatureValid);

        // Bentuk { event, data } (QR v2 / e-wallet) dengan reference_id.
        $nested = $driver->handleWebhook(['x-callback-token' => 'cb-token'], ['event' => 'qr.payment', 'data' => ['id' => 'qrpy_1', 'reference_id' => 'IKN-1-2', 'status' => 'SUCCEEDED', 'amount' => 1000]]);
        $this->assertSame('IKN-1-2', $nested->externalId);
        $this->assertSame('qr.payment', $nested->event);
        $this->assertSame('paid', $nested->status);

        $this->assertSame('expired', $driver->handleWebhook(['x-callback-token' => 'cb-token'], ['external_id' => 'x', 'status' => 'EXPIRED'])->status);
        $this->assertSame('failed', $driver->handleWebhook(['x-callback-token' => 'cb-token'], ['external_id' => 'x', 'status' => 'FAILED'])->status);
        $this->assertNull($driver->handleWebhook(['x-callback-token' => 'cb-token'], ['external_id' => 'x', 'status' => 'PENDING'])->status);

        try {
            $driver->handleWebhook(['x-callback-token' => 'salah'], ['external_id' => 'x', 'status' => 'PAID']);
            $this->fail('expected 401');
        } catch (ApiException $e) {
            $this->assertSame(401, $e->status);
            $this->assertSame('WEBHOOK_SIGNATURE_INVALID', $e->errorCode);
        }

        // Token belum dikonfigurasi → selalu 401.
        config(['ikn.gateways.xendit.callback_token' => null]);
        $this->expectException(ApiException::class);
        $driver->handleWebhook([], ['external_id' => 'x', 'status' => 'PAID']);
    }

    public function test_gateway_errors_and_missing_secret(): void
    {
        $this->setUpCommerce();
        Http::fake(['api.xendit.co/qr_codes' => Http::response(['error_code' => 'API_VALIDATION_ERROR', 'message' => 'bad'], 400)]);

        try {
            $this->paymentFor(PaymentMethod::TYPE_QRIS_DYNAMIC);
            $this->fail('expected GATEWAY_ERROR');
        } catch (ApiException $e) {
            $this->assertSame(502, $e->status);
            $this->assertSame('GATEWAY_ERROR', $e->errorCode);
            $this->assertSame(400, $e->meta['status']);
        }
        // Transaksi checkout dibatalkan: tidak ada order/payment tersisa.
        $this->assertSame(0, \App\Models\Order::count());
        $this->assertSame(0, \App\Models\StockMovement::where('type', 'reserve')->count());

        config(['ikn.gateways.xendit.secret_key' => null]);
        try {
            $this->paymentFor(PaymentMethod::TYPE_QRIS_DYNAMIC);
            $this->fail('expected GATEWAY_UNAVAILABLE');
        } catch (ApiException $e) {
            $this->assertSame(503, $e->status);
            $this->assertSame('GATEWAY_UNAVAILABLE', $e->errorCode);
        }
    }
}
