<?php

namespace App\Models;

use App\Support\HasTranslations;
use App\Support\Money;

class ShippingRate extends Model
{
    use HasTranslations;

    public const TYPE_FLAT = 'flat';
    public const TYPE_PER_KG = 'per_kg';
    public const TYPES = [self::TYPE_FLAT, self::TYPE_PER_KG];

    protected $fillable = ['zone_id', 'name', 'type', 'base_amount', 'per_kg_amount', 'min_amount', 'free_above', 'eta', 'is_active', 'sort_order'];

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

    /**
     * Ongkir untuk berat dan subtotal (setelah diskon) tertentu:
     * amount = max(min_amount, base + per_kg × ceil(kg)); 0 bila subtotal ≥ free_above.
     */
    public function amountFor(int $weightGram, int $subtotalAfterDiscount): int
    {
        if ($this->free_above !== null && $subtotalAfterDiscount >= Money::toInt($this->free_above)) {
            return 0;
        }

        $amount = Money::toInt($this->base_amount);
        if ($this->type === self::TYPE_PER_KG) {
            $kg = (int) ceil(max(0, $weightGram) / 1000);
            $amount += Money::toInt($this->per_kg_amount) * $kg;
        }

        return max(Money::toInt($this->min_amount), $amount);
    }
}
