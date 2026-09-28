<?php

namespace Tests\Support;

use App\Models\Region;

// Subset wilayah nyata (kode Kemendagri) untuk test alamat/wilayah tanpa mengimpor 91 ribu baris.
trait SeedsRegions
{
    /** Konstanta di trait baru ada di PHP 8.2; pakai method statis agar tetap jalan di PHP 8.1. */
    protected static function regionFixture(): array
    {
        return [
            ['31', 'Daerah Khusus Ibukota Jakarta'],
            ['31.75', 'Kota Administrasi Jakarta Timur'],
            ['31.75.03', 'Jatinegara'],
            ['31.75.03.1003', 'Bali Mester'],
            ['31.75.06', 'Cakung'],
            ['31.75.06.1004', 'Cakung Timur'],
            ['31.75.06.1007', 'Cakung Barat'],
            ['12', 'Sumatera Utara'],
            ['12.71', 'Kota Medan'],
            ['12.71.06', 'Medan Deli'],
            ['12.71.06.1005', 'Mabar'],
        ];
    }

    protected function seedRegions(): void
    {
        foreach (self::regionFixture() as [$code, $name]) {
            Region::firstOrCreate(
                ['code' => $code],
                ['parent_code' => Region::parentCodeFor($code), 'level' => Region::levelForCode($code), 'name' => $name]
            );
        }
    }

    /** Payload alamat valid (Jakarta Timur / Cakung / Cakung Barat) sesuai kontrak bagian 4. */
    protected function jakartaAddress(array $overrides = []): array
    {
        return array_merge([
            'label' => 'Gudang Utama Jakarta',
            'recipientName' => 'Budi Santoso / Gudang',
            'phone' => '081234567890',
            'addressLine' => 'Jl. Industri Raya No. 45, Kawasan Industri Pulogadung',
            'provinceCode' => '31',
            'regencyCode' => '31.75',
            'districtCode' => '31.75.06',
            'villageCode' => '31.75.06.1007',
            'postalCode' => '13910',
            'lat' => -6.1834,
            'lng' => 106.9118,
            'note' => 'Masuk dari gerbang 2',
        ], $overrides);
    }

    /** Payload alamat valid (Medan / Medan Deli / Mabar). */
    protected function medanAddress(array $overrides = []): array
    {
        return array_merge($this->jakartaAddress([
            'label' => 'Cabang Medan',
            'recipientName' => 'Rina Hasibuan',
            'addressLine' => 'Jl. Yos Sudarso Km. 8,5 No. 12',
            'provinceCode' => '12',
            'regencyCode' => '12.71',
            'districtCode' => '12.71.06',
            'villageCode' => '12.71.06.1005',
            'postalCode' => '20242',
            'lat' => 3.6713,
            'lng' => 98.6823,
        ]), $overrides);
    }
}
