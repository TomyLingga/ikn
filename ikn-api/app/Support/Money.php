<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Uang (kontrak bagian 1, ASUMSI A-86): DB decimal(15,2) dalam satuan mayor (IDR 125000.00, USD 12.50);
 * JSON integer dalam satuan terkecil mata uang order (IDR = rupiah bulat, USD = sen) + field `currency`.
 * Tidak ada float di JSON. Pembulatan half-up.
 */
final class Money
{
    public const CURRENCY_IDR = 'IDR';
    public const CURRENCY_USD = 'USD';
    public const CURRENCIES = [self::CURRENCY_IDR, self::CURRENCY_USD];

    /** Jumlah desimal satuan terkecil per mata uang. */
    public const MINOR_DIGITS = [self::CURRENCY_IDR => 0, self::CURRENCY_USD => 2];

    /** Rupiah bulat dari decimal DB (pemanggil IDR lama). @param mixed $value decimal string, int, float, atau null */
    public static function toInt($value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }

        return self::round(is_string($value) ? (float) str_replace(',', '.', $value) : $value);
    }

    /** @param int|float $value */
    public static function round($value): int
    {
        return (int) round((float) $value, 0, PHP_ROUND_HALF_UP);
    }

    /** Kode mata uang yang dikenal (uppercase); null/kosong = IDR. */
    public static function normalizeCurrency(?string $currency): string
    {
        $code = strtoupper(trim((string) $currency));
        if ($code === '') {
            return self::CURRENCY_IDR;
        }
        if (! in_array($code, self::CURRENCIES, true)) {
            throw new InvalidArgumentException("Unknown currency '{$currency}'.");
        }

        return $code;
    }

    public static function isIdr(?string $currency): bool
    {
        return self::normalizeCurrency($currency) === self::CURRENCY_IDR;
    }

    public static function isUsd(?string $currency): bool
    {
        return self::normalizeCurrency($currency) === self::CURRENCY_USD;
    }

    /**
     * Decimal DB (satuan mayor) → integer satuan terkecil: IDR 125000.00 → 125000, USD 12.50 → 1250.
     *
     * @param  mixed  $value  decimal string dari DB, int, float, atau null
     */
    public static function toMinor($value, string $currency): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $digits = self::MINOR_DIGITS[self::normalizeCurrency($currency)];
        $float = is_string($value) ? (float) str_replace(',', '.', $value) : (float) $value;

        return self::round($float * (10 ** $digits));
    }

    /** Integer satuan terkecil → decimal string untuk kolom DB: IDR 125000 → "125000", USD 1250 → "12.50". */
    public static function fromMinor(int $minor, string $currency): string
    {
        $digits = self::MINOR_DIGITS[self::normalizeCurrency($currency)];
        if ($digits === 0) {
            return (string) $minor;
        }
        $base = 10 ** $digits;
        $sign = $minor < 0 ? '-' : '';
        $abs = abs($minor);

        return sprintf('%s%d.%0'.$digits.'d', $sign, intdiv($abs, $base), $abs % $base);
    }

    /** Teks untuk email/notifikasi: "Rp 1.234.567" atau "USD 12.50". */
    public static function format(int $minor, string $currency = self::CURRENCY_IDR): string
    {
        $currency = self::normalizeCurrency($currency);
        if ($currency === self::CURRENCY_IDR) {
            return 'Rp '.number_format($minor, 0, ',', '.');
        }
        $digits = self::MINOR_DIGITS[$currency];

        return $currency.' '.number_format($minor / (10 ** $digits), $digits, '.', ',');
    }

    /** Alokasikan $total secara proporsional ke $weights (pembulatan kumulatif, jumlah selalu = $total). */
    public static function allocate(int $total, array $weights): array
    {
        $sum = array_sum($weights);
        if ($sum <= 0 || $total === 0) {
            return array_fill(0, count($weights), 0);
        }

        $out = [];
        $cumulativeWeight = 0;
        $allocated = 0;
        foreach (array_values($weights) as $weight) {
            $cumulativeWeight += $weight;
            $target = self::round($total * $cumulativeWeight / $sum);
            $out[] = $target - $allocated;
            $allocated = $target;
        }

        return $out;
    }
}
