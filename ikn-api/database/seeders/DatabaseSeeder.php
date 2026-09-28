<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

// Seeder demo idempoten: aman dijalankan berulang, tidak menimpa konten yang sudah diubah admin.
class DatabaseSeeder extends Seeder
{
    public function run()
    {
        $this->call([
            UserSeeder::class,
            SettingSeeder::class,
            MediaSeeder::class,
            MenuSeeder::class,
            ContentSeeder::class,
            CmsPageSeeder::class,
            // Commerce (phase e-commerce): urutan mengikuti ketergantungan data.
            RegionSeeder::class,         // wilayah Kemendagri (regions)
            CustomerSeeder::class,       // customer demo aktif + pending + alamat
            CatalogSeeder::class,        // kategori, produk, gambar, stok awal (ledger), ulasan
            CommerceConfigSeeder::class, // rekening, fee, zona/tarif ongkir, voucher, metode bayar, settings commerce
            CommerceDemoSeeder::class,   // order demo di berbagai status + payment
        ]);
    }
}
