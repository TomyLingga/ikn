<?php

namespace App\Services\Commerce;

use App\Models\DeliveryTerm;
use Illuminate\Validation\ValidationException;

/**
 * Pilih cara serah terima untuk quote/checkout (ASUMSI A-85): kode yang dikirim harus aktif dan sesuai pasar;
 * tanpa kode = baris aktif pertama pasar itu (sort_order). Pasar berasal dari customer (User::market(), ASUMSI A-86):
 * customer ekspor tidak bisa memilih term lokal dan sebaliknya.
 */
class DeliveryTermResolver
{
    /** @throws ValidationException 422 deliveryTermCode */
    public function resolve(?string $code, string $market = DeliveryTerm::MARKET_LOCAL): DeliveryTerm
    {
        $code = trim((string) $code);

        if ($code !== '') {
            $term = DeliveryTerm::where('code', strtolower($code))->first();
            if (! $term || ! $term->is_active || $term->market !== $market) {
                throw ValidationException::withMessages(['deliveryTermCode' => [__('catalog.quote.delivery_term_invalid')]]);
            }

            return $term;
        }

        $term = DeliveryTerm::active()->forMarket($market)->orderBy('sort_order')->orderBy('id')->first();
        if (! $term) {
            throw ValidationException::withMessages(['deliveryTermCode' => [__('catalog.quote.delivery_term_unavailable')]]);
        }

        return $term;
    }

    /** Seperti resolve(), tetapi null bila tidak sah (untuk aturan validasi bersyarat di Form Request). */
    public function tryResolve(?string $code, string $market = DeliveryTerm::MARKET_LOCAL): ?DeliveryTerm
    {
        try {
            return $this->resolve($code, $market);
        } catch (ValidationException $e) {
            return null;
        }
    }
}
