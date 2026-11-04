<?php

namespace App\Services\Commerce\Shipping;

use App\Models\FactoryLocation;
use App\Models\ShippingRate;
use App\Models\ShippingZone;
use App\Models\ShippingZoneRegion;
use App\Services\Commerce\CommerceSettings;
use Illuminate\Support\Arr;

/**
 * Ongkir berbasis zona (arsitektur bagian 9 langkah 4): zona paling spesifik menang
 * (village → district → regency → province), lalu zona default (is_default atau tanpa region) sebagai cadangan.
 * Tarif "calculated" memakai tiga parameter (ASUMSI A-76): jarak km (garis lurus titik asal → titik peta alamat × faktor
 * jalan, dibulatkan ke atas), berat kg, volume m³ — lihat ShippingRate::breakdown().
 * Dua pabrik atau lebih (ASUMSI A-90): keranjang dipecah per pabrik asal (parcel); tiap parcel dihitung terpisah dengan
 * berat, volume, dan jarak dari pabriknya (base dan min_amount per parcel karena tiap pabrik mengirim sendiri), lalu
 * dijumlah. free_above dibandingkan dengan subtotal − diskon seluruh order: bila tercapai, semua parcel 0.
 */
class ZoneRateCalculator implements ShippingRateCalculator
{
    private const EARTH_RADIUS_KM = 6371.0088;

    public function __construct(private CommerceSettings $settings)
    {
    }

    public function ratesFor($address, array $parcels, int $subtotalAfterDiscount): array
    {
        $zone = $this->resolveZone($address);
        if (! $zone) {
            return [];
        }

        $parcels = $parcels ?: [['factory' => null, 'weightGram' => 0, 'volumeCm3' => 0]];
        $rates = $zone->rates()->active()->orderBy('sort_order')->orderBy('id')->get();
        // Jarak per pabrik dihitung sekali (bukan per tarif); null = pabrik atau alamat tanpa titik peta.
        $distances = [];
        if ($rates->contains(fn (ShippingRate $rate) => $rate->needsDistance())) {
            foreach ($parcels as $i => $parcel) {
                $distances[$i] = $this->distanceKm($parcel['factory'] ?? null, $address);
            }
        }

        return $rates
            ->map(fn (ShippingRate $rate) => $this->present($rate, $parcels, $distances, $subtotalAfterDiscount, $address))
            ->values()->all();
    }

    public function quote(int $rateId, $address, array $parcels, int $subtotalAfterDiscount): ?array
    {
        foreach ($this->ratesFor($address, $parcels, $subtotalAfterDiscount) as $rate) {
            if ($rate['rateId'] === $rateId && $rate['available']) {
                return $rate;
            }
        }

        return null;
    }

    /**
     * Jarak jalan perkiraan (km, dibulatkan ke atas) dari titik pabrik asal ke titik peta alamat; null bila salah satu
     * titik belum diatur.
     *
     * @param  FactoryLocation|object|array|null  $origin  pabrik asal (lat/lng)
     * @param  object|array  $address
     */
    public function distanceKm($origin, $address): ?int
    {
        $originLat = $origin === null ? null : $this->coordinate($origin, 'lat');
        $originLng = $origin === null ? null : $this->coordinate($origin, 'lng');
        $lat = $this->coordinate($address, 'lat');
        $lng = $this->coordinate($address, 'lng');
        if ($originLat === null || $originLng === null || $lat === null || $lng === null) {
            return null;
        }

        $straight = self::haversineKm($originLat, $originLng, $lat, $lng);
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

    /**
     * Satu tarif untuk semua parcel: amount = Σ amount parcel; breakdown = Σ bagian (minimumApplied bila ada parcel yang
     * kena minimum); distanceKm = jarak terjauh; origins[] = rincian per pabrik. Tarif per km tidak tersedia bila ada
     * parcel tanpa jarak; `unavailable` menjelaskan sebabnya untuk warning quote (tarif itu disaring sebelum ke FE).
     *
     * @param  array<int, array{factory: ?FactoryLocation, weightGram: int, volumeCm3: int}>  $parcels
     * @param  array<int, int|null>  $distances  indeks parcel => km
     * @param  object|array  $address
     */
    private function present(ShippingRate $rate, array $parcels, array $distances, int $subtotalAfterDiscount, $address): array
    {
        $needsDistance = $rate->needsDistance();
        $totals = ['base' => 0, 'distance' => 0, 'weight' => 0, 'volume' => 0];
        $minimumApplied = false;
        $free = false;
        $amount = 0;
        $origins = [];
        $missing = [];
        $kms = [];

        foreach ($parcels as $i => $parcel) {
            /** @var FactoryLocation|null $factory */
            $factory = $parcel['factory'] ?? null;
            $km = $needsDistance ? ($distances[$i] ?? null) : null;
            if ($needsDistance && $km === null && (! $factory || ! $factory->hasPoint())) {
                $missing[] = $factory ? $factory->code : null;
            }
            $kms[] = $km;

            $breakdown = $rate->breakdown((int) $parcel['weightGram'], $subtotalAfterDiscount, (int) $parcel['volumeCm3'], $km);
            $parcelAmount = $breakdown['amount'];
            unset($breakdown['amount']);
            foreach ($totals as $part => $value) {
                $totals[$part] = $value + $breakdown[$part];
            }
            $minimumApplied = $minimumApplied || $breakdown['minimumApplied'];
            $free = $breakdown['free'];
            $amount += $parcelAmount;

            $origins[] = [
                'factory' => $factory ? $factory->toBrief() : null,
                'weightGram' => (int) $parcel['weightGram'],
                'volumeCm3' => (int) $parcel['volumeCm3'],
                'distanceKm' => $km,
                'amount' => $parcelAmount,
                'breakdown' => $breakdown,
            ];
        }

        $available = ! $needsDistance || ! in_array(null, $kms, true);
        $out = [
            'rateId' => $rate->id,
            'zoneId' => $rate->zone_id,
            'label' => $rate->name,
            'eta' => $rate->eta,
            'amount' => $available ? $amount : 0,
            'type' => $rate->isCalculated() ? ShippingRate::TYPE_CALCULATED : ShippingRate::TYPE_FLAT,
            'available' => $available,
            'distanceKm' => $needsDistance && $available ? max($kms) : null,
            'weightGram' => array_sum(array_map(fn ($parcel) => (int) $parcel['weightGram'], $parcels)),
            'volumeCm3' => array_sum(array_map(fn ($parcel) => (int) $parcel['volumeCm3'], $parcels)),
            'breakdown' => $totals + ['minimumApplied' => $minimumApplied, 'free' => $free],
            'origins' => $origins,
        ];

        if (! $available) {
            $out['unavailable'] = [
                // false = alamat belum punya titik peta (warning distance_unavailable).
                'addressPoint' => $this->coordinate($address, 'lat') !== null && $this->coordinate($address, 'lng') !== null,
                // Pabrik tanpa koordinat (warning factory_location_unset); null = tidak ada pabrik sama sekali.
                'factoryCodes' => array_values(array_unique($missing, SORT_REGULAR)),
            ];
        }

        return $out;
    }
}
