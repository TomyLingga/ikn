<?php

namespace Database\Seeders;

use App\Models\DeliveryTerm;
use Illuminate\Database\Seeder;

// Cara serah terima bawaan (ASUMSI A-85, keputusan "Ekspor dan serah terima"): Loco aktif, Franco nonaktif,
// FOB Belawan dan CIF untuk pasar ekspor (tax_profile export). Idempoten per kode; admin bebas mengubah setelahnya.
// Migrasi 2026_11_02_000020 memetakan kolom satu per satu (tax_profile belum ada di sana; diisi migrasi 000080).
class DeliveryTermSeeder extends Seeder
{
    public function run(): void
    {
        foreach (self::rows() as $row) {
            DeliveryTerm::firstOrCreate(['code' => $row['code']], $row);
        }
    }

    /** @return array<int, array<string, mixed>> */
    public static function rows(): array
    {
        return [
            [
                'code' => 'loco', 'family' => DeliveryTerm::FAMILY_PICKUP, 'market' => DeliveryTerm::MARKET_LOCAL,
                'pricing_mode' => DeliveryTerm::PRICING_NONE, 'tax_profile' => DeliveryTerm::TAX_DOMESTIC, 'is_active' => true, 'sort_order' => 1,
                'name' => ['id' => 'Loco (ambil di pabrik)', 'en' => 'Loco (pickup at factory)'],
                'description' => ['id' => 'Barang diambil sendiri di pabrik. Tanpa biaya kirim.', 'en' => 'Goods are collected at the factory. No shipping cost.'],
            ],
            [
                'code' => 'franco', 'family' => DeliveryTerm::FAMILY_DOOR, 'market' => DeliveryTerm::MARKET_LOCAL,
                'pricing_mode' => DeliveryTerm::PRICING_ZONE, 'tax_profile' => DeliveryTerm::TAX_DOMESTIC, 'is_active' => false, 'sort_order' => 2,
                'name' => ['id' => 'Franco (diantar ke alamat)', 'en' => 'Franco (delivered to your address)'],
                'description' => ['id' => 'Barang diantar ke alamat Anda. Ongkos kirim dihitung dari zona alamat, berat, dan volume.', 'en' => 'Goods are delivered to your address. Shipping cost follows the address zone, weight and volume.'],
            ],
            [
                'code' => 'fob', 'family' => DeliveryTerm::FAMILY_PORT, 'market' => DeliveryTerm::MARKET_EXPORT,
                'pricing_mode' => DeliveryTerm::PRICING_INCLUDED, 'tax_profile' => DeliveryTerm::TAX_EXPORT, 'loading_port' => 'Belawan', 'is_active' => true, 'sort_order' => 3,
                'name' => ['id' => 'FOB Belawan', 'en' => 'FOB Belawan'],
                'description' => ['id' => 'Harga USD sudah termasuk pengangkutan sampai di atas kapal di Pelabuhan Belawan. Ongkos kapal ditanggung pembeli.', 'en' => 'The USD price includes delivery on board the vessel at Belawan Port. Ocean freight is paid by the buyer.'],
            ],
            [
                'code' => 'cif', 'family' => DeliveryTerm::FAMILY_PORT, 'market' => DeliveryTerm::MARKET_EXPORT,
                'pricing_mode' => DeliveryTerm::PRICING_QUOTED, 'tax_profile' => DeliveryTerm::TAX_EXPORT, 'insurance_included' => true, 'requires_destination_port' => true,
                'loading_port' => 'Belawan', 'is_active' => true, 'sort_order' => 4,
                'name' => ['id' => 'CIF pelabuhan tujuan', 'en' => 'CIF destination port'],
                'description' => ['id' => 'Ongkos kapal dan asuransi sampai pelabuhan tujuan ditawarkan admin setelah pesanan dibuat.', 'en' => 'Ocean freight and insurance to the destination port are quoted by our team after the order is placed.'],
            ],
        ];
    }
}
