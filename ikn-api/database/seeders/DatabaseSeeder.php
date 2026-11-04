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
            FactoryLocationSeeder::class, // lokasi pabrik (Tanjung Morawa, Sei Bamban); sebelum katalog yang merujuknya
            CatalogSeeder::class,        // kategori, produk, gambar, stok awal (ledger), ulasan
            CommerceConfigSeeder::class, // rekening, fee, zona/tarif ongkir, voucher, metode bayar, settings commerce
            DeliveryTermSeeder::class,   // cara serah terima (Loco aktif, Franco nonaktif, FOB, CIF)
            PaymentTermSeeder::class,    // syarat pembayaran ekspor (T/T di muka, 30/70 terhadap B/L)
            CommerceDemoSeeder::class,   // order demo di berbagai status + payment
            DemoCasesSeeder::class,      // kasus lain: WBS, pesan kontak, stok rendah/habis, audit log
        ]);
    }
}
