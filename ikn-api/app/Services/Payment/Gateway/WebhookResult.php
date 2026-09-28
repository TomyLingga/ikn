<?php

namespace App\Services\Payment\Gateway;

use App\Models\PaymentWebhookLog;

// Hasil normalisasi webhook gateway (dikembalikan driver, diproses PaymentService::handleWebhook).
final class WebhookResult
{
    public ?int $paymentId = null;

    public ?string $externalId = null;

    public string $event = '';

    /** Status ter-map: paid|expired|failed|null (null = event tidak mengubah status). */
    public ?string $status = null;

    public ?string $providerStatus = null;

    public ?int $amount = null;

    public ?string $paidAt = null;

    public ?string $providerId = null;

    /** processed|duplicate|ignored|error (diisi PaymentService setelah efek diterapkan). */
    public string $result = PaymentWebhookLog::RESULT_IGNORED;

    public ?string $note = null;

    public bool $signatureValid = false;

    public array $raw = [];

    public static function make(?string $externalId, string $event, ?string $status, array $raw = []): self
    {
        $result = new self();
        $result->externalId = $externalId;
        $result->event = $event;
        $result->status = $status;
        $result->raw = $raw;

        return $result;
    }

    /** Bentuk respons webhook: { received: true, result, paymentId? }. */
    public function toArray(): array
    {
        return [
            'received' => true,
            'result' => $this->result,
            'event' => $this->event,
            'externalId' => $this->externalId,
            'paymentId' => $this->paymentId,
        ];
    }
}
