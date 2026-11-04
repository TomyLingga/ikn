<?php

namespace App\Services\Commerce\Shipping;

/**
 * Kontrak kalkulator ongkir (KEPUTUSAN ongkir): implementasi default ZoneRateCalculator; bisa diganti RajaOngkir/Biteship.
 *
 * $address = model App\Models\CustomerAddress (BE-1) atau array/objek dengan properti
 * province_code|provinceCode, regency_code|regencyCode, district_code|districtCode, village_code|villageCode (+ lat/lng).
 *
 * $parcels = keranjang dipecah per pabrik asal (ASUMSI A-90):
 *   [ ['factory' => App\Models\FactoryLocation|null, 'weightGram' => int, 'volumeCm3' => int], ... ]
 *
 * Bentuk tarif: [ 'rateId' => int, 'zoneId' => int, 'label' => {id,en}, 'eta' => {id,en}|null, 'amount' => int (Σ parcel),
 *   'type' => 'flat|calculated', 'available' => bool (false = butuh jarak tetapi titik peta alamat/pabrik belum ada),
 *   'distanceKm' => int|null (jarak terjauh), 'weightGram' => int, 'volumeCm3' => int,
 *   'breakdown' => {base, distance, weight, volume, minimumApplied, free} (Σ parcel, ASUMSI A-76),
 *   'origins' => [ {factory {code, name}|null, weightGram, volumeCm3, distanceKm, amount, breakdown} ],
 *   'unavailable' => {addressPoint: bool, factoryCodes: (string|null)[]} hanya bila available false ].
 */
interface ShippingRateCalculator
{
    /**
     * Semua tarif aktif zona alamat ini, sudah dihitung per parcel (jarak, berat, volume) dan subtotal order (setelah diskon).
     *
     * @param  object|array  $address
     * @param  array<int, array{factory: ?\App\Models\FactoryLocation, weightGram: int, volumeCm3: int}>  $parcels
     * @return array<int, array>
     */
    public function ratesFor($address, array $parcels, int $subtotalAfterDiscount): array;

    /**
     * Satu tarif terpilih; null bila rate tidak berlaku untuk alamat tersebut.
     *
     * @param  object|array  $address
     * @param  array<int, array{factory: ?\App\Models\FactoryLocation, weightGram: int, volumeCm3: int}>  $parcels
     */
    public function quote(int $rateId, $address, array $parcels, int $subtotalAfterDiscount): ?array;
}
