<?php

namespace Database\Seeders;

use App\Models\FactoryLocation;
use Illuminate\Database\Seeder;

// Lokasi pabrik bawaan (ASUMSI A-90): titik asal ongkir per km (Franco) sekaligus titik ambil Loco. Urutan pertama =
// pabrik bawaan untuk produk tanpa pabrik. Migrasi 2026_11_04_000010 mengisi baris yang sama (dengan nilai dari pengaturan
// lama bila ada), jadi seeder ini hanya cadangan idempoten per kode; admin bebas mengubah setelahnya.
class FactoryLocationSeeder extends Seeder
{
    public const TANJUNG_MORAWA = 'tanjung-morawa';
    public const SEI_BAMBAN = 'sei-bamban';

    public function run(): void
    {
        foreach (self::rows() as $row) {
            FactoryLocation::firstOrCreate(['code' => $row['code']], $row);
        }
    }

    /** @return array<int, array<string, mixed>> */
    public static function rows(): array
    {
        return [
            [
                // Pabrik barang karet, satu lokasi dengan kantor pusat (CmsPageSeeder::GEO_HEAD_OFFICE).
                'code' => self::TANJUNG_MORAWA,
                'name' => ['id' => 'Pabrik Tanjung Morawa', 'en' => 'Tanjung Morawa Factory'],
                'address' => 'Jl. Medan - Tanjung Morawa Km 9,5, Medan 20148, Sumatera Utara, Indonesia',
                'lat' => 3.5387,
                'lng' => 98.7467,
                'allows_pickup' => true,
                'sort_order' => 1,
            ],
            [
                // Pabrik Resiprene (CmsPageSeeder::GEO_RESIPRENE_PLANT), titik asal ongkir lama.
                'code' => self::SEI_BAMBAN,
                'name' => ['id' => 'Pabrik Resiprene Sei Bamban', 'en' => 'Resiprene Factory Sei Bamban'],
                'address' => 'Sei Bamban Estate, Kec. Sei Bamban, Kab. Serdang Bedagai 20695, Sumatera Utara, Indonesia',
                'lat' => 3.3495,
                'lng' => 99.0862,
                'allows_pickup' => true,
                'sort_order' => 2,
            ],
        ];
    }
}
