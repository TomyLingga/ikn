<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bentuk Payment (kontrak bagian 9–10): id, method, status, amount, instructions, bankAccount, qrisImageUrl, proof ringkas.
 * Butuh with(['paymentMethod', 'bankAccount', 'proof', 'verifier']).
 */
class PaymentResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var Payment $payment */
        $payment = $this->resource;
        $payload = $payment->payload ?? [];
        $method = $payment->paymentMethod;
        $proof = $payment->proof;
        $gateway = null;
        if (! $payment->isManual()) {
            $gateway = array_filter([
                'providerId' => $payload['providerId'] ?? null,
                'qrString' => $payload['qrString'] ?? null,
                'accountNumber' => $payload['accountNumber'] ?? null,
                'bankCode' => $payload['bankCode'] ?? null,
                'checkoutUrl' => $payload['checkoutUrl'] ?? null,
                'channelCode' => $payload['channelCode'] ?? null,
                'providerStatus' => $payload['providerStatus'] ?? null,
            ], fn ($v) => $v !== null);
        }

        return [
            'id' => $payment->id,
            'orderId' => $payment->order_id,
            'method' => $payment->method,
            'methodName' => $method?->name,
            'type' => $method?->type ?? ($payload['type'] ?? null),
            'provider' => $payment->provider,
            'externalId' => $payment->external_id,
            'amount' => $payment->amountInt(),
            'status' => $payment->status,
            'expiresAt' => optional($payment->expires_at)->toApiString(),
            'paidAt' => optional($payment->paid_at)->toApiString(),
            'instructions' => $payload['instructions'] ?? $method?->instructions,
            'bankAccount' => $payload['bankAccount'] ?? null,
            'qrisImageUrl' => $payload['qrisImageUrl'] ?? null,
            'uniqueCode' => (int) ($payload['uniqueCode'] ?? 0),
            'gateway' => $gateway ?: null,
            'proof' => $proof ? [
                'mediaId' => $proof->id,
                'url' => $proof->url(),
                'originalName' => $proof->original_name,
                'mime' => $proof->mime,
                'size' => $proof->size,
                'uploadedAt' => optional($payment->proof_uploaded_at)->toApiString(),
            ] : null,
            'verifiedBy' => $payment->verifier ? ['id' => $payment->verifier->id, 'name' => $payment->verifier->name] : null,
            'verifiedAt' => optional($payment->verified_at)->toApiString(),
            'rejectReason' => $payment->reject_reason,
            'createdAt' => optional($payment->created_at)->toApiString(),
            'updatedAt' => optional($payment->updated_at)->toApiString(),
        ];
    }

    public static function eager(): array
    {
        return ['paymentMethod', 'bankAccount', 'proof', 'verifier'];
    }
}
