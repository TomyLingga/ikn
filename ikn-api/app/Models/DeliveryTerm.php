<?php

namespace App\Models;

use App\Support\HasTranslations;
use Illuminate\Database\Eloquent\Builder;

/**
 * Cara serah terima (ASUMSI A-85): Loco (ambil di pabrik), Franco (diantar, tarif zona), FOB/CIF (ekspor).
 * Order menyimpan kodenya di orders.delivery_term dan ringkasannya di shipping_snapshot {term, family, pricingMode}.
 */
class DeliveryTerm extends Model
{
    use HasTranslations;

    public const FAMILY_PICKUP = 'pickup';
    public const FAMILY_DOOR = 'door';
    public const FAMILY_PORT = 'port';
    public const FAMILIES = [self::FAMILY_PICKUP, self::FAMILY_DOOR, self::FAMILY_PORT];

    public const MARKET_LOCAL = 'local';
    public const MARKET_EXPORT = 'export';
    public const MARKETS = [self::MARKET_LOCAL, self::MARKET_EXPORT];

    /** none = tanpa ongkir; zone = tarif zona; included = sudah termasuk harga; quoted = penawaran admin per order. */
    public const PRICING_NONE = 'none';
    public const PRICING_ZONE = 'zone';
    public const PRICING_INCLUDED = 'included';
    public const PRICING_QUOTED = 'quoted';
    public const PRICING_MODES = [self::PRICING_NONE, self::PRICING_ZONE, self::PRICING_INCLUDED, self::PRICING_QUOTED];

    /** Pajak mengikuti term (ASUMSI A-86): domestic = setting tax_rate, export = setting export_tax_rate. */
    public const TAX_DOMESTIC = 'domestic';
    public const TAX_EXPORT = 'export';
    public const TAX_PROFILES = [self::TAX_DOMESTIC, self::TAX_EXPORT];

    protected $fillable = [
        'code', 'name', 'description', 'family', 'market', 'pricing_mode', 'tax_profile', 'insurance_included',
        'loading_port', 'requires_destination_port', 'is_active', 'sort_order',
    ];

    protected $translatable = ['name', 'description'];

    protected $casts = [
        'insurance_included' => 'boolean',
        'requires_destination_port' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function orders()
    {
        return $this->hasMany(Order::class, 'delivery_term', 'code');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeForMarket(Builder $query, string $market): Builder
    {
        return $query->where('market', $market);
    }

    public function isPickup(): bool
    {
        return $this->family === self::FAMILY_PICKUP;
    }

    public function usesZone(): bool
    {
        return $this->pricing_mode === self::PRICING_ZONE;
    }

    public function isPort(): bool
    {
        return $this->family === self::FAMILY_PORT;
    }

    public function taxProfile(): string
    {
        return $this->tax_profile === self::TAX_EXPORT ? self::TAX_EXPORT : self::TAX_DOMESTIC;
    }

    public function isExportTax(): bool
    {
        return $this->taxProfile() === self::TAX_EXPORT;
    }

    /** Bentuk publik (GET /commerce/config, QuoteResult.deliveryTerm). */
    public function toPublicArray(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'family' => $this->family,
            'market' => $this->market,
            'pricingMode' => $this->pricing_mode,
            'taxProfile' => $this->taxProfile(),
            'insuranceIncluded' => (bool) $this->insurance_included,
            'loadingPort' => $this->loading_port,
            'requiresDestinationPort' => (bool) $this->requires_destination_port,
        ];
    }
}
