<?php

namespace App\Services\Commerce;

use App\Models\PaymentTerm;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Pilih syarat pembayaran untuk quote/checkout (ASUMSI A-87): wajib untuk customer ekspor, opsional untuk lokal;
 * kode yang dikirim harus aktif dan sesuai pasar customer. Hanya dibekukan ke order sebagai snapshot.
 */
class PaymentTermResolver
{
    /**
     * @param  bool  $required  true saat checkout (customer ekspor wajib memilih); false saat quote
     *
     * @throws ValidationException 422 paymentTermCode
     */
    public function resolve(?string $code, User $user, bool $required = true): ?PaymentTerm
    {
        $code = strtolower(trim((string) $code));
        $market = $user->market();

        if ($code === '') {
            if ($required && $user->isExport()) {
                throw ValidationException::withMessages(['paymentTermCode' => [__('commerce.payment_term_required')]]);
            }

            return null;
        }

        $term = PaymentTerm::where('code', $code)->first();
        if (! $term || ! $term->is_active || $term->market !== $market) {
            throw ValidationException::withMessages(['paymentTermCode' => [__('commerce.payment_term_invalid')]]);
        }

        return $term;
    }
}
