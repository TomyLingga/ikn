<?php

namespace App\Models;

use App\Services\Commerce\FactoryLocations;
use App\Support\HasTranslations;

/**
 * Lokasi pabrik (ASUMSI A-90): titik asal ongkir per km untuk Franco (ZoneRateCalculator) dan titik ambil Loco.
 * Urutan pertama (sort_order, id) = pabrik bawaan untuk produk tanpa factory_location_id.
 */
class FactoryLocation extends Model
{
    use HasTranslations;

    protected $fillable = ['code', 'name', 'address', 'lat', 'lng', 'allows_pickup', 'sort_order'];

    protected $translatable = ['name'];

    protected $casts = ['allows_pickup' => 'boolean', 'sort_order' => 'integer'];

    protected static function booted(): void
    {
        // Daftar pabrik di-cache per request/job (FactoryLocations); perubahan admin langsung berlaku.
        $flush = fn () => app()->resolved(FactoryLocations::class) ? app(FactoryLocations::class)->forget() : null;
        static::saved($flush);
        static::deleted($flush);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function hasPoint(): bool
    {
        return $this->lat !== null && $this->lng !== null;
    }

    public function latitude(): ?float
    {
        return $this->lat === null ? null : round((float) $this->lat, 6);
    }

    public function longitude(): ?float
    {
        return $this->lng === null ? null : round((float) $this->lng, 6);
    }

    /** Ringkasan untuk produk admin: { id, code, name }. */
    public function toSummary(): array
    {
        return ['id' => $this->id, 'code' => $this->code, 'name' => $this->name];
    }

    /** Ringkasan publik (produk, origins[] ongkir): { code, name }. */
    public function toBrief(): array
    {
        return ['code' => $this->code, 'name' => $this->name];
    }

    /** Bentuk GET /commerce/config `factories[]`. */
    public function toPublicArray(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'address' => $this->address,
            'lat' => $this->latitude(),
            'lng' => $this->longitude(),
            'allowsPickup' => (bool) $this->allows_pickup,
        ];
    }

    /** Titik ambil Loco lama { label, address, lat, lng } (GET /commerce/config `pickup`). */
    public function toPickupArray(?string $locale = null): array
    {
        return [
            'label' => $this->tr('name', $locale),
            'address' => $this->address,
            'lat' => $this->latitude(),
            'lng' => $this->longitude(),
        ];
    }
}
