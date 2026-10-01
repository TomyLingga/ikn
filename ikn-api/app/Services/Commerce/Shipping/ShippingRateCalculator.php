<?php

namespace App\Services\Commerce\Shipping;

/**
 * Kontrak kalkulator ongkir (KEPUTUSAN ongkir): implementasi default ZoneRateCalculator; bisa diganti RajaOngkir/Biteship.
 *
 * $address = model App\Models\CustomerAddress (BE-1) atau array/objek dengan properti
 * province_code|provinceCode, regency_code|regencyCode, district_code|districtCode, village_code|villageCode.
 *
 * Bentuk tarif: [ 'rateId' => int, 'zoneId' => int, 'label' => {id,en}, 'eta' => {id,en}|null, 'amount' => int,
 *   'type' => 'flat|calculated', 'available' => bool (false = butuh jarak tetapi titik peta alamat/asal belum ada),
 *   'distanceKm' => int|null, 'weightGram' => int, 'volumeCm3' => int,
 *   'breakdown' => {base, distance, weight, volume, minimumApplied, free} ] (ASUMSI A-76).
 */
interface ShippingRateCalculator
{
    /**
     * Semua tarif aktif zona alamat ini, sudah dihitung untuk jarak, berat, volume, dan subtotal (setelah diskon).
     *
     * @param  object|array  $address
     * @return array<int, array>
     */
    public function ratesFor($address, int $weightGram, int $subtotalAfterDiscount, int $volumeCm3 = 0): array;

    /**
     * Satu tarif terpilih; null bila rate tidak berlaku untuk alamat tersebut.
     *
     * @param  object|array  $address
     */
    public function quote(int $rateId, $address, int $weightGram, int $subtotalAfterDiscount, int $volumeCm3 = 0): ?array;
}
