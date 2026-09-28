<?php

namespace App\Services\Payment\Gateway;

use App\Models\Payment;

/**
 * Kontrak driver pembayaran (KEPUTUSAN pembayaran). ManualDriver = transfer manual & QRIS statis (verifikasi admin);
 * XenditDriver = kerangka gateway (ASUMSI A-15). Resolver: GatewayManager::for(PaymentMethod).
 */
interface PaymentGateway
{
    /** Nama provider (payments.provider, {provider} pada route webhook). */
    public function provider(): string;

    /**
     * Buat percobaan bayar di sisi provider (atau susun instruksi manual). Hasilnya disimpan ke payments.payload.
     * Untuk gateway: wajib memuat kunci `providerId` (id objek di gateway) dan `externalId`.
     */
    public function create(Payment $payment): array;

    /** @return array{status:?string, providerStatus:?string, raw:array} status ter-map ke Payment::STATUS_* atau null */
    public function checkStatus(Payment $payment): array;

    /** Batalkan percobaan bayar di sisi provider (no-op bila tidak didukung). */
    public function cancel(Payment $payment): void;

    /**
     * Verifikasi tanda tangan/token dan normalisasi payload webhook.
     *
     * @param  array<string, string>  $headers  nama header lowercase → nilai
     *
     * @throws \App\Exceptions\ApiException 401 WEBHOOK_SIGNATURE_INVALID bila tanda tangan salah
     */
    public function handleWebhook(array $headers, array $payload): WebhookResult;
}
