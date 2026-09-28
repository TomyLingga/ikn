<?php

namespace App\Services\Payment\Gateway;

use App\Exceptions\ApiException;
use App\Models\Payment;
use App\Models\PaymentMethod;

/**
 * Driver pembayaran manual (manual_transfer, qris_static): tidak ada API eksternal; customer mengunggah bukti,
 * admin memverifikasi. create() menyusun instruksi + rekening/QRIS yang dibekukan ke payments.payload.
 */
class ManualDriver implements PaymentGateway
{
    public function provider(): string
    {
        return PaymentMethod::DRIVER_MANUAL;
    }

    public function create(Payment $payment): array
    {
        $payment->loadMissing(['paymentMethod', 'bankAccount', 'order']);
        $method = $payment->paymentMethod;
        $order = $payment->order;

        return [
            'externalId' => $payment->external_id,
            'type' => $method?->type,
            'instructions' => $method?->instructions ?? ['id' => '', 'en' => ''],
            'bankAccount' => $method && $method->isManualTransfer() && $payment->bankAccount
                ? $payment->bankAccount->toSummary()
                : null,
            'qrisImageUrl' => $method && $method->type === PaymentMethod::TYPE_QRIS_STATIC ? $method->qrisImageUrl() : null,
            'amount' => $payment->amountInt(),
            'uniqueCode' => $order ? (int) $order->unique_code : 0,
            'expiresAt' => optional($payment->expires_at)->toApiString(),
        ];
    }

    public function checkStatus(Payment $payment): array
    {
        return ['status' => $payment->status, 'providerStatus' => $payment->status, 'raw' => []];
    }

    public function cancel(Payment $payment): void
    {
        // Tidak ada objek di sisi provider.
    }

    public function handleWebhook(array $headers, array $payload): WebhookResult
    {
        throw ApiException::notFound(__('commerce.webhook_unsupported'));
    }
}
