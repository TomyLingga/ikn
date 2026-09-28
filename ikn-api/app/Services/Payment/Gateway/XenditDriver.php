<?php

namespace App\Services\Payment\Gateway;

use App\Exceptions\ApiException;
use App\Models\Payment;
use App\Models\PaymentMethod;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Kerangka gateway Xendit (ASUMSI A-15) lewat Laravel HTTP client, tanpa SDK. Belum dipakai produksi
 * (metode gateway is_active=false); diuji dengan Http::fake. Rahasia hanya dari config('ikn.gateways.xendit').
 *
 * - qris_dynamic   → POST /qr_codes (QR dinamis per order), status GET /qr_codes/{id}
 * - virtual_account→ POST /callback_virtual_accounts (VA closed, single use), status GET /callback_virtual_accounts/{id}
 * - ewallet        → POST /ewallets/charges (ONE_TIME_PAYMENT), status GET /ewallets/charges/{id}
 * - webhook        → header x-callback-token = callback_token; status SUCCEEDED|PAID|COMPLETED → paid, EXPIRED → expired, FAILED → failed
 */
class XenditDriver implements PaymentGateway
{
    public const PROVIDER = PaymentMethod::DRIVER_XENDIT;

    public const STATUS_MAP = [
        'SUCCEEDED' => Payment::STATUS_PAID,
        'PAID' => Payment::STATUS_PAID,
        'COMPLETED' => Payment::STATUS_PAID,
        'SETTLED' => Payment::STATUS_PAID,
        'EXPIRED' => Payment::STATUS_EXPIRED,
        'INACTIVE' => Payment::STATUS_EXPIRED,
        'FAILED' => Payment::STATUS_FAILED,
        'VOIDED' => Payment::STATUS_FAILED,
        'PENDING' => null,
        'ACTIVE' => null,
    ];

    public function provider(): string
    {
        return self::PROVIDER;
    }

    public function create(Payment $payment): array
    {
        $payment->loadMissing(['paymentMethod', 'order']);
        $method = $payment->paymentMethod;
        $order = $payment->order;
        $config = $method?->config ?? [];
        $externalId = $payment->external_id;
        $expiresAt = optional($payment->expires_at)->copy()->setTimezone('UTC')->toIso8601ZuluString();

        switch ($method?->type) {
            case PaymentMethod::TYPE_QRIS_DYNAMIC:
                $response = $this->http()->withHeaders(['api-version' => '2022-07-31'])->post('/qr_codes', [
                    'reference_id' => $externalId,
                    'type' => 'DYNAMIC',
                    'currency' => 'IDR',
                    'amount' => $payment->amountInt(),
                    'expires_at' => $expiresAt,
                    'metadata' => ['orderNumber' => $order?->number],
                ]);
                $data = $this->assertOk($response);

                return [
                    'externalId' => $externalId,
                    'providerId' => $data['id'] ?? null,
                    'type' => PaymentMethod::TYPE_QRIS_DYNAMIC,
                    'qrString' => $data['qr_string'] ?? null,
                    'instructions' => $method->instructions,
                    'amount' => $payment->amountInt(),
                    'expiresAt' => $data['expires_at'] ?? $expiresAt,
                    'providerStatus' => $data['status'] ?? null,
                    'raw' => $data,
                ];

            case PaymentMethod::TYPE_VIRTUAL_ACCOUNT:
                $response = $this->http()->post('/callback_virtual_accounts', [
                    'external_id' => $externalId,
                    'bank_code' => $config['bankCode'] ?? 'BCA',
                    'name' => mb_substr((string) ($order?->customerName() ?: 'IKN Customer'), 0, 50),
                    'expected_amount' => $payment->amountInt(),
                    'is_closed' => true,
                    'is_single_use' => true,
                    'expiration_date' => $expiresAt,
                ]);
                $data = $this->assertOk($response);

                return [
                    'externalId' => $externalId,
                    'providerId' => $data['id'] ?? null,
                    'type' => PaymentMethod::TYPE_VIRTUAL_ACCOUNT,
                    'bankCode' => $data['bank_code'] ?? ($config['bankCode'] ?? null),
                    'accountNumber' => $data['account_number'] ?? null,
                    'accountName' => $data['name'] ?? null,
                    'instructions' => $method->instructions,
                    'amount' => $payment->amountInt(),
                    'expiresAt' => $data['expiration_date'] ?? $expiresAt,
                    'providerStatus' => $data['status'] ?? null,
                    'raw' => $data,
                ];

            case PaymentMethod::TYPE_EWALLET:
                $response = $this->http()->post('/ewallets/charges', [
                    'reference_id' => $externalId,
                    'currency' => 'IDR',
                    'amount' => $payment->amountInt(),
                    'checkout_method' => 'ONE_TIME_PAYMENT',
                    'channel_code' => $config['channelCode'] ?? 'ID_OVO',
                    'channel_properties' => [
                        'success_redirect_url' => rtrim((string) config('ikn.frontend_url'), '/').'/dashboard/pesanan/'.($order?->number ?? ''),
                    ],
                    'metadata' => ['orderNumber' => $order?->number],
                ]);
                $data = $this->assertOk($response);
                $actions = $data['actions'] ?? [];

                return [
                    'externalId' => $externalId,
                    'providerId' => $data['id'] ?? null,
                    'type' => PaymentMethod::TYPE_EWALLET,
                    'channelCode' => $data['channel_code'] ?? ($config['channelCode'] ?? null),
                    'checkoutUrl' => $actions['desktop_web_checkout_url'] ?? $actions['mobile_web_checkout_url'] ?? $actions['mobile_deeplink_checkout_url'] ?? null,
                    'instructions' => $method->instructions,
                    'amount' => $payment->amountInt(),
                    'expiresAt' => $expiresAt,
                    'providerStatus' => $data['status'] ?? null,
                    'raw' => $data,
                ];
        }

        throw new ApiException(422, 'VALIDATION_ERROR', __('commerce.gateway_unsupported_type'));
    }

    public function checkStatus(Payment $payment): array
    {
        $payload = $payment->payload ?? [];
        $providerId = $payload['providerId'] ?? null;
        if (! $providerId) {
            return ['status' => null, 'providerStatus' => null, 'raw' => []];
        }

        switch ($payload['type'] ?? null) {
            case PaymentMethod::TYPE_QRIS_DYNAMIC:
                $response = $this->http()->withHeaders(['api-version' => '2022-07-31'])->get('/qr_codes/'.$providerId);
                break;
            case PaymentMethod::TYPE_VIRTUAL_ACCOUNT:
                $response = $this->http()->get('/callback_virtual_accounts/'.$providerId);
                break;
            case PaymentMethod::TYPE_EWALLET:
                $response = $this->http()->get('/ewallets/charges/'.$providerId);
                break;
            default:
                return ['status' => null, 'providerStatus' => null, 'raw' => []];
        }

        $data = $this->assertOk($response);
        $providerStatus = strtoupper((string) ($data['status'] ?? ''));

        return [
            'status' => self::mapStatus($providerStatus),
            'providerStatus' => $providerStatus ?: null,
            'raw' => $data,
        ];
    }

    public function cancel(Payment $payment): void
    {
        $payload = $payment->payload ?? [];
        $providerId = $payload['providerId'] ?? null;
        if (! $providerId) {
            return;
        }

        // Hanya VA punya endpoint pembatalan (kedaluwarsakan sekarang); QR dinamis dan e-wallet dibiarkan kedaluwarsa sendiri.
        if (($payload['type'] ?? null) === PaymentMethod::TYPE_VIRTUAL_ACCOUNT) {
            $response = $this->http()->patch('/callback_virtual_accounts/'.$providerId, [
                'expiration_date' => now()->setTimezone('UTC')->toIso8601ZuluString(),
            ]);
            $this->assertOk($response);
        }
    }

    public function handleWebhook(array $headers, array $payload): WebhookResult
    {
        $expected = (string) config('ikn.gateways.xendit.callback_token');
        $given = (string) ($headers['x-callback-token'] ?? '');
        if ($expected === '' || $given === '' || ! hash_equals($expected, $given)) {
            throw new ApiException(401, 'WEBHOOK_SIGNATURE_INVALID', __('commerce.webhook_signature_invalid'));
        }

        // Xendit: objek datar (VA, QR v1) atau { event, data: {...} } (QR v2, e-wallet).
        $data = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : $payload;
        $providerStatus = strtoupper((string) ($data['status'] ?? $payload['status'] ?? ''));
        $event = (string) ($payload['event'] ?? ($providerStatus !== '' ? strtolower($providerStatus) : 'unknown'));
        $externalId = $data['external_id'] ?? $data['reference_id'] ?? $payload['external_id'] ?? $payload['reference_id'] ?? null;

        $result = WebhookResult::make($externalId !== null ? (string) $externalId : null, $event, self::mapStatus($providerStatus), $payload);
        $result->signatureValid = true;
        $result->providerStatus = $providerStatus ?: null;
        $result->providerId = isset($data['id']) ? (string) $data['id'] : null;
        $amount = $data['amount'] ?? $data['expected_amount'] ?? $data['capture_amount'] ?? null;
        $result->amount = $amount !== null ? (int) round((float) $amount) : null;
        $result->paidAt = $data['paid_at'] ?? $data['transaction_timestamp'] ?? $data['updated'] ?? null;

        return $result;
    }

    public static function mapStatus(string $providerStatus): ?string
    {
        return self::STATUS_MAP[strtoupper($providerStatus)] ?? null;
    }

    public function isConfigured(): bool
    {
        return (string) config('ikn.gateways.xendit.secret_key') !== '';
    }

    private function http(): PendingRequest
    {
        if (! $this->isConfigured()) {
            throw new ApiException(503, 'GATEWAY_UNAVAILABLE', __('commerce.gateway_unavailable'));
        }

        return Http::baseUrl(rtrim((string) config('ikn.gateways.xendit.base_url'), '/'))
            ->withBasicAuth((string) config('ikn.gateways.xendit.secret_key'), '')
            ->acceptJson()
            ->timeout(15);
    }

    private function assertOk(Response $response): array
    {
        if ($response->failed()) {
            $body = $response->json();
            $message = is_array($body) ? ($body['message'] ?? $body['error_code'] ?? '') : '';

            throw new ApiException(502, 'GATEWAY_ERROR', __('commerce.gateway_error'), [
                'status' => $response->status(),
                'error' => $message,
            ]);
        }

        return $response->json() ?? [];
    }
}
