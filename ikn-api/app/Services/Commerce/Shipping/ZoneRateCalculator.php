<?php

namespace App\Services\Commerce\Shipping;

use App\Models\ShippingRate;
use App\Models\ShippingZone;
use App\Models\ShippingZoneRegion;
use Illuminate\Support\Arr;

/**
 * Ongkir berbasis zona (arsitektur bagian 9 langkah 4): zona paling spesifik menang
 * (village → district → regency → province), lalu zona default (is_default atau tanpa region) sebagai cadangan.
 * amount = max(min_amount, base + per_kg × ceil(kg)); 0 bila subtotal − diskon ≥ free_above.
 */
class ZoneRateCalculator implements ShippingRateCalculator
{
    public function ratesFor($address, int $weightGram, int $subtotalAfterDiscount): array
    {
        $zone = $this->resolveZone($address);
        if (! $zone) {
            return [];
        }

        return $zone->rates()->active()->get()
            ->map(fn (ShippingRate $rate) => $this->present($rate, $weightGram, $subtotalAfterDiscount))
            ->values()->all();
    }

    public function quote(int $rateId, $address, int $weightGram, int $subtotalAfterDiscount): ?array
    {
        foreach ($this->ratesFor($address, $weightGram, $subtotalAfterDiscount) as $rate) {
            if ($rate['rateId'] === $rateId) {
                return $rate;
            }
        }

        return null;
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

    private function present(ShippingRate $rate, int $weightGram, int $subtotalAfterDiscount): array
    {
        return [
            'rateId' => $rate->id,
            'zoneId' => $rate->zone_id,
            'label' => $rate->name,
            'eta' => $rate->eta,
            'amount' => $rate->amountFor($weightGram, $subtotalAfterDiscount),
            'type' => $rate->type,
        ];
    }
}
