<?php

namespace App\Models;

use App\Support\HasTranslations;
use App\Support\Money;

class ShippingRate extends Model
{
    use HasTranslations;

    public const TYPE_FLAT = 'flat';
    /** Dihitung dari tiga parameter: jarak (km), berat (kg), volume (m³) — ASUMSI A-76. */
    public const TYPE_CALCULATED = 'calculated';
    /** Nama lama tipe "calculated" (sebelum 2026-10-02); masih diterima di input, disimpan sebagai calculated. */
    public const TYPE_PER_KG = 'per_kg';
    public const TYPES = [self::TYPE_FLAT, self::TYPE_CALCULATED];

    protected $fillable = [
        'zone_id', 'name', 'type', 'base_amount', 'per_km_amount', 'per_kg_amount', 'per_m3_amount',
        'min_amount', 'free_above', 'eta', 'is_active', 'sort_order',
    ];

    protected $translatable = ['name', 'eta'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function zone()
    {
        return $this->belongsTo(ShippingZone::class, 'zone_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function isCalculated(): bool
    {
        return in_array($this->type, [self::TYPE_CALCULATED, self::TYPE_PER_KG], true);
    }

    /** Tarif butuh jarak bila bertipe calculated dengan tarif per km > 0. */
    public function needsDistance(): bool
    {
        return $this->isCalculated() && Money::toInt($this->per_km_amount) > 0;
    }

    /**
     * Rincian ongkir untuk satu kiriman:
     *   flat       → base
     *   calculated → base + per_km × ⌈km⌉ + per_kg × ⌈kg⌉ + per_m3 × m³ (volume dibulatkan ke atas 0,01 m³)
     * lalu max(min_amount, …); 0 bila subtotal setelah diskon ≥ free_above.
     *
     * @return array{base:int, distance:int, weight:int, volume:int, minimumApplied:bool, free:bool, amount:int}
     */
    public function breakdown(int $weightGram, int $subtotalAfterDiscount, int $volumeCm3 = 0, ?int $distanceKm = null): array
    {
        $parts = ['base' => Money::toInt($this->base_amount), 'distance' => 0, 'weight' => 0, 'volume' => 0];

        if ($this->isCalculated()) {
            $parts['distance'] = Money::toInt($this->per_km_amount) * max(0, (int) $distanceKm);
            $parts['weight'] = Money::toInt($this->per_kg_amount) * self::chargeableKg($weightGram);
            $parts['volume'] = Money::round(Money::toInt($this->per_m3_amount) * self::chargeableM3($volumeCm3));
        }

        $sum = array_sum($parts);
        $min = Money::toInt($this->min_amount);
        $free = $this->free_above !== null && $subtotalAfterDiscount >= Money::toInt($this->free_above);

        return $parts + [
            'minimumApplied' => ! $free && $min > $sum,
            'free' => $free,
            'amount' => $free ? 0 : max($min, $sum),
        ];
    }

    public function amountFor(int $weightGram, int $subtotalAfterDiscount, int $volumeCm3 = 0, ?int $distanceKm = null): int
    {
        return $this->breakdown($weightGram, $subtotalAfterDiscount, $volumeCm3, $distanceKm)['amount'];
    }

    /** Berat ditagih per kg penuh (dibulatkan ke atas). */
    public static function chargeableKg(int $weightGram): int
    {
        return (int) ceil(max(0, $weightGram) / 1000);
    }

    /** Volume ditagih per 0,01 m³ (dibulatkan ke atas), mis. 12.345 cm³ → 0,02 m³. */
    public static function chargeableM3(int $volumeCm3): float
    {
        return ceil(max(0, $volumeCm3) / 10000) / 100;
    }
}
