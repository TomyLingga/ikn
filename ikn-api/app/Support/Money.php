<?php

namespace App\Support;

// Uang: decimal(15,2) di DB, integer rupiah bulat di JSON (kontrak bagian 1). Pembulatan half-up.
final class Money
{
    /** @param mixed $value decimal string dari DB, int, float, atau null */
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
