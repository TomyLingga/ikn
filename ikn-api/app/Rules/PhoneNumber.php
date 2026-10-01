<?php

namespace App\Rules;

use Illuminate\Contracts\Validation\Rule;

/**
 * Nomor telepon internasional (ASUMSI A-78): format E.164 `+<kode negara><nomor>` dengan total 8–15 digit, mis.
 * +6281234567890 atau +60123456789. Spasi, strip, titik, dan kurung boleh. Nomor tanpa "+" yang diawali 0 atau 62
 * dianggap nomor Indonesia (kompatibel dengan data lama). Untuk +62 berlaku aturan nasional: digit setelah 62 tidak
 * diawali 0 dan panjangnya 8–13.
 */
class PhoneNumber implements Rule
{
    public function passes($attribute, $value): bool
    {
        return self::normalize($value) !== null;
    }

    /** Bentuk E.164 (+6281234567890) atau null bila tidak valid. */
    public static function normalize($value): ?string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }
        $raw = trim((string) $value);
        if ($raw === '' || ! preg_match('/^\+?[0-9 ().-]+$/', $raw)) {
            return null;
        }
        $digits = preg_replace('/\D/', '', $raw);

        if (! str_starts_with($raw, '+')) {
            // Tanpa kode negara: hanya nomor Indonesia (0… atau 62…).
            if (str_starts_with($digits, '0')) {
                $digits = '62'.substr($digits, 1);
            } elseif (! str_starts_with($digits, '62')) {
                return null;
            }
        }

        if (! preg_match('/^[1-9][0-9]{7,14}$/', $digits)) {
            return null;
        }
        if (str_starts_with($digits, '62') && ! preg_match('/^62[1-9][0-9]{7,12}$/', $digits)) {
            return null;
        }

        return '+'.$digits;
    }

    public function message(): string
    {
        return __('account.phone_invalid');
    }
}
