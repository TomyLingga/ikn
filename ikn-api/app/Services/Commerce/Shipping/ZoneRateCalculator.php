<?php

namespace App\Services\Commerce\Shipping;

use App\Models\ShippingRate;
use App\Models\ShippingZone;
use App\Models\ShippingZoneRegion;
use App\Services\Commerce\CommerceSettings;
use Illuminate\Support\Arr;

/**
 * Ongkir berbasis zona (arsitektur bagian 9 langkah 4): zona paling spesifik menang
 * (village → district → regency → province), lalu zona default (is_default atau tanpa region) sebagai cadangan.
 * Tarif "calculated" memakai tiga parameter (ASUMSI A-76): jarak km (garis lurus titik asal → titik peta alamat × faktor
 * jalan, dibulatkan ke atas), berat kg, volume m³ — lihat ShippingRate::breakdown(). 0 bila subtotal − diskon ≥ free_above.
 */
class ZoneRateCalculator implements ShippingRateCalculator
{
    private const EARTH_RADIUS_KM = 6371.0088;

    public function __construct(private CommerceSettings $settings)
    {
    }

    public function ratesFor($address, int $weightGram, int $subtotalAfterDiscount, int $volumeCm3 = 0): array
    {
        $zone = $this->resolveZone($address);
        if (! $zone) {
            return [];
        }

        $rates = $zone->rates()->active()->orderBy('sort_order')->orderBy('id')->get();
        $distanceKm = $rates->contains(fn (ShippingRate $rate) => $rate->needsDistance()) ? $this->distanceKm($address) : null;

        return $rates
            ->map(fn (ShippingRate $rate) => $this->present($rate, $weightGram, $subtotalAfterDiscount, $volumeCm3, $distanceKm))
            ->values()->all();
    }

    public function quote(int $rateId, $address, int $weightGram, int $subtotalAfterDiscount, int $volumeCm3 = 0): ?array
    {
        foreach ($this->ratesFor($address, $weightGram, $subtotalAfterDiscount, $volumeCm3) as $rate) {
            if ($rate['rateId'] === $rateId && $rate['available']) {
                return $rate;
            }
        }

        return null;
    }

    /**
     * Jarak jalan perkiraan (km, dibulatkan ke atas) dari titik asal pengaturan commerce ke titik peta alamat;
     * null bila salah satu titik belum diatur.
     *
     * @param  object|array  $address
     */
    public function distanceKm($address): ?int
    {
        $originLat = $this->settings->get('shipping_origin_lat');
        $originLng = $this->settings->get('shipping_origin_lng');
        $lat = $this->coordinate($address, 'lat');
        $lng = $this->coordinate($address, 'lng');
        if ($originLat === null || $originLng === null || $lat === null || $lng === null) {
            return null;
        }

        $straight = self::haversineKm((float) $originLat, (float) $originLng, $lat, $lng);
        $factor = max(1.0, (float) $this->settings->get('shipping_road_factor'));

        return (int) max(1, ceil($straight * $factor));
    }

    public static function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * self::EARTH_RADIUS_KM * asin(min(1.0, sqrt($a)));
    }

    /** @param  object|array  $address */
    private function coordinate($address, string $key): ?float
    {
        $value = null;
        if (is_array($address)) {
            $value = $address[$key] ?? Arr::get($address, 'geo.'.$key);
        } elseif (is_object($address)) {
            $value = $address->{$key} ?? null;
        }

        return $value === null || $value === '' || ! is_numeric($value) ? null : (float) $value;
    }

    /** @param  object|array  $address */
    public function resolveZone($address): ?ShippingZone
    {
        $codes = $this->addressCodes($address);

        if ($codes) {
            $match = ShippingZoneRegion::query()
                ->join('shipping_zones', 'shipping_zones.id', '=', 'shipping_zone_regions.zone_id')
                ->where('shipping_zones.is_active', true)
                ->where(function ($q) use ($codes) {
                    foreach ($codes as $level => $code) {
                        $q->orWhere(function ($w) use ($level, $code) {
                            $w->where('shipping_zone_regions.level', $level)->where('shipping_zone_regions.region_code', $code);
                        });
                    }
                })
                ->get(['shipping_zone_regions.zone_id', 'shipping_zone_regions.level', 'shipping_zones.priority'])
                ->sort(function ($a, $b) {
                    // Paling spesifik dulu, lalu priority terbesar, lalu id terkecil (deterministik).
                    return [ShippingZoneRegion::SPECIFICITY[$b->level] ?? 0, (int) $b->priority, -(int) $b->zone_id]
                        <=> [ShippingZoneRegion::SPECIFICITY[$a->level] ?? 0, (int) $a->priority, -(int) $a->zone_id];
                })
                ->first();

            if ($match) {
                return ShippingZone::find($match->zone_id);
            }
        }

        return $this->defaultZone();
    }

    /** Zona cadangan: is_default aktif, atau zona aktif tanpa region sama sekali (prioritas tertinggi). */
    public function defaultZone(): ?ShippingZone
    {
        return ShippingZone::active()->where('is_default', true)->orderByDesc('priority')->orderBy('id')->first()
            ?? ShippingZone::active()->whereDoesntHave('regions')->orderByDesc('priority')->orderBy('id')->first();
    }

    /**
     * Kode wilayah dari alamat (duck typing; tidak bergantung pada kelas CustomerAddress secara statis).
     *
     * @return array<string, string> level => code
     */
    private function addressCodes($address): array
    {
        $read = function (string $snake) use ($address) {
            $camel = lcfirst(str_replace('_', '', ucwords($snake, '_')));
            if (is_array($address)) {
                return $address[$snake] ?? $address[$camel] ?? Arr::get($address, 'region.'.$camel) ?? null;
            }
            if (is_object($address)) {
                return $address->{$snake} ?? $address->{$camel} ?? null;
            }

            return null;
        };

        $codes = [];
        foreach ([
            ShippingZoneRegion::LEVEL_PROVINCE => 'province_code',
            ShippingZoneRegion::LEVEL_REGENCY => 'regency_code',
            ShippingZoneRegion::LEVEL_DISTRICT => 'district_code',
            ShippingZoneRegion::LEVEL_VILLAGE => 'village_code',
        ] as $level => $attribute) {
            $value = $read($attribute);
            if ($value !== null && trim((string) $value) !== '') {
                $codes[$level] = trim((string) $value);
            }
        }

        return $codes;
    }

    private function present(ShippingRate $rate, int $weightGram, int $subtotalAfterDiscount, int $volumeCm3, ?int $distanceKm): array
    {
        $available = ! $rate->needsDistance() || $distanceKm !== null;
        $breakdown = $rate->breakdown($weightGram, $subtotalAfterDiscount, $volumeCm3, $distanceKm);
        $amount = $breakdown['amount'];
        unset($breakdown['amount']);

        return [
            'rateId' => $rate->id,
            'zoneId' => $rate->zone_id,
            'label' => $rate->name,
            'eta' => $rate->eta,
            'amount' => $available ? $amount : 0,
            'type' => $rate->isCalculated() ? ShippingRate::TYPE_CALCULATED : ShippingRate::TYPE_FLAT,
            'available' => $available,
            'distanceKm' => $rate->needsDistance() ? $distanceKm : null,
            'weightGram' => $weightGram,
            'volumeCm3' => $volumeCm3,
            'breakdown' => $breakdown,
        ];
    }
}
