<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\FactoryLocation;
use App\Models\Media;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Review;
use App\Models\User;
use App\Services\Media\MediaService;
use App\Services\Stock\StockLedger;
use Illuminate\Database\Seeder;

// Kategori, produk (dari ikn-fe/lib/mock-data.ts + foto di assets/products), gambar produk,
// saldo stok awal lewat StockLedger (bukan set kolom), ulasan demo. Idempoten: tidak menimpa data yang sudah ada.
class CatalogSeeder extends Seeder
{
    /** Kategori => kode pabrik asal (ASUMSI A-90). */
    private const FACTORY_BY_CATEGORY = [
        'resiprene' => FactoryLocationSeeder::SEI_BAMBAN,
        'rubber-articles' => FactoryLocationSeeder::TANJUNG_MORAWA,
    ];

    public function run(MediaService $media, StockLedger $ledger): void
    {
        $categories = $this->categories();
        $this->products($categories, $media, $ledger);
        $this->reviews();
    }

    /** @return array<string, Category> slug → kategori */
    private function categories(): array
    {
        $rows = [
            ['slug' => 'resiprene', 'name' => ['id' => 'Resiprene', 'en' => 'Resiprene'], 'description' => ['id' => 'Resiprene 35, karet alam tersiklisasi (cyclised natural rubber) untuk coating pelindung, cat kapal, cat dan pernis, serta tinta cetak.', 'en' => 'Resiprene 35, cyclised natural rubber for protective coatings, marine paints, paints and varnishes, and printing inks.'], 'sort_order' => 0],
            ['slug' => 'rubber-articles', 'name' => ['id' => 'Aneka Barang Karet', 'en' => 'Rubber Articles'], 'description' => ['id' => 'Sarung egrek, sepatu boots, packing, ring, dan komponen karet lain untuk perkebunan dan pabrik kelapa sawit.', 'en' => 'Sickle covers, boots, packing, rings and other rubber parts for plantations and palm oil mills.'], 'sort_order' => 1],
        ];

        $out = [];
        foreach ($rows as $row) {
            $out[$row['slug']] = Category::firstOrCreate(['slug' => $row['slug']], $row + ['is_active' => true]);
        }

        return $out;
    }

    private function products(array $categories, MediaService $media, StockLedger $ledger): void
    {
        foreach ($this->productRows() as $row) {
            $images = $row['images'];
            $stock = $row['stock'];
            unset($row['images'], $row['stock']);

            $product = Product::withTrashed()->where('slug', $row['slug'])->first();
            if (! $product) {
                $row['category_id'] = $categories[$row['category']]->id;
                // Pabrik asal (ASUMSI A-90): Resiprene dari Sei Bamban, barang karet dari Tanjung Morawa. Hanya produk baru;
                // produk yang sudah ada tidak diubah karena pabriknya bisa sudah diatur admin.
                $row['factory_location_id'] = FactoryLocation::where('code', self::FACTORY_BY_CATEGORY[$row['category']] ?? '')->value('id');
                unset($row['category']);
                $product = Product::create($row + ['is_published' => true, 'is_taxable' => true]);
            } elseif ($product->price_usd === null && isset($row['price_usd']) && $product->isFixedPrice()) {
                // Harga USD demo (ASUMSI A-86) diisi juga untuk basis data yang sudah ada sebelum Phase E3; nilai yang
                // sudah diisi admin tidak ditimpa.
                $product->forceFill(['price_usd' => $row['price_usd']])->save();
            }

            if ($product->images()->count() === 0) {
                foreach ($images as $sort => $file) {
                    $mediaRow = $this->productImage($file, $media);
                    if ($mediaRow) {
                        ProductImage::firstOrCreate(['product_id' => $product->id, 'media_id' => $mediaRow->id], ['sort_order' => $sort]);
                    }
                }
            }

            if ($stock > 0 && $product->isFixedPrice() && ! $product->stockMovements()->exists()) {
                $ledger->in($product, $stock, 'Saldo awal (seeder)');
            }
        }
    }

    /** Media foto produk: pakai yang sudah diimpor (nama asli sama) atau impor dari assets. */
    private function productImage(string $file, MediaService $media): ?Media
    {
        $existing = MediaSeeder::find($file);
        if ($existing) {
            return $existing;
        }

        foreach ([database_path('seeders/assets/products/'.$file), database_path('seeders/assets/'.$file)] as $path) {
            if (is_file($path)) {
                return $media->importFromPath($path, 'products', Media::DISK_PUBLIC, $file);
            }
        }

        return null;
    }

    private function reviews(): void
    {
        $product = Product::where('slug', 'resiprene-35')->first();
        $customers = User::where('role', User::ROLE_CUSTOMER)->orderBy('id')->get();
        if (! $product || $customers->isEmpty()) {
            return;
        }

        $buyer = $customers->firstWhere('email', 'buyer@coatingsolutions.co.id') ?? $customers->first();
        $other = $customers->first(fn (User $u) => $u->id !== $buyer->id) ?? $buyer;

        $rows = [
            [$buyer, 5, 'Konsisten antar batch, cepat kering. Cocok untuk formulasi cat marine kami.', '2026-05-12 09:00:00'],
            [$other, 4, 'Kualitas bagus dan pengiriman tepat waktu. Dokumentasi teknis lengkap.', '2026-04-02 10:30:00'],
        ];

        foreach ($rows as [$user, $rating, $body, $at]) {
            $exists = Review::where('product_id', $product->id)->where('user_id', $user->id)->where('body', $body)->exists();
            if ($exists) {
                continue;
            }
            $review = new Review(['product_id' => $product->id, 'user_id' => $user->id, 'order_id' => null, 'rating' => $rating, 'body' => $body, 'is_published' => true]);
            $review->created_at = $at;
            $review->updated_at = $at;
            $review->save();
        }
    }

    /**
     * Data produk: 3 dari mock + 9 dari foto di assets/products. Uang integer rupiah, berat gram realistis.
     * price_usd = harga demo per satuan basis FOB Belawan (decimal satuan mayor, ASUMSI A-86), bukan harga resmi klien.
     */
    private function productRows(): array
    {
        return [
            [
                'slug' => 'sarung-egrek', 'code' => 'IKN-PRD-001', 'category' => 'rubber-articles',
                'name' => ['id' => 'Sarung Egrek', 'en' => 'Rubber Palm Sickle Cover'], 'kind' => 'Rubber Articles',
                'aliases' => ['sarung egrek', 'sarung pisau egrek', 'sarung egrek sawit', 'egrek', 'cover egrek'],
                'price_mode' => 'fixed', 'price' => 125000, 'price_usd' => 7.80, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 350, 'length_cm' => 65, 'width_cm' => 9, 'height_cm' => 5, 'stock' => 500,
                'summary' => ['id' => 'Sarung pelindung mata pisau egrek, alat panen di perkebunan kelapa sawit. Terbuat dari PVC berwarna oranye dengan ukuran 9 x 65 cm. Termasuk lini alat pelindung diri (APD) dari pabrik Tanjung Morawa.', 'en' => 'Protective cover for the blade of the egrek, the harvesting sickle used on oil palm plantations. Made of orange PVC, 9 x 65 cm. Part of the personal protective equipment (PPE) range from the Tanjung Morawa plant.'],
                'highlights' => ['id' => ['PVC oranye, 9 x 65 cm', 'Menutup mata pisau egrek', 'Lini APD perkebunan'], 'en' => ['Orange PVC, 9 x 65 cm', 'Covers the egrek blade', 'Plantation PPE range']],
                'specs' => [['Material', 'PVC (oranye)'], ['Ukuran', '9 x 65 cm'], ['Fungsi', 'Pelindung mata pisau egrek'], ['Aplikasi', 'Perkebunan kelapa sawit']],
                'applications' => ['id' => ['Perkebunan kelapa sawit', 'Keselamatan kerja panen'], 'en' => ['Oil palm plantations', 'Harvesting safety']],
                'solubility' => [], 'images' => ['sarung-egrek.jpg'],
            ],
            [
                'slug' => 'sepatu-boots', 'code' => 'IKN-PRD-002', 'category' => 'rubber-articles',
                'name' => ['id' => 'Sepatu Boots', 'en' => 'Industrial Rubber Boots'], 'kind' => 'Rubber Articles',
                'aliases' => ['sepatu boots', 'boots karet', 'sepatu boots industri', 'sepatu perkebunan', 'boots ptpn', 'rubin boots'],
                'price_mode' => 'fixed', 'price' => 170000, 'price_usd' => 10.60, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 1800, 'length_cm' => 30, 'width_cm' => 20, 'height_cm' => 8, 'stock' => 350,
                'summary' => ['id' => 'Sepatu boots dari karet PVC untuk pekerja perkebunan dan pabrik. Tinggi 37 sampai 38 cm, ukuran 38 sampai 44, warna hitam, kuning, atau army. Tersedia model non safety dan model safety dengan toe cap 200 joule. Logo pada sepatu bisa disesuaikan.', 'en' => 'PVC rubber boots for plantation and factory workers. Height 37 to 38 cm, sizes 38 to 44, in black, yellow or army. Available as a non-safety model and a safety model with a 200 joule toe cap. The logo on the boots can be customised.'],
                'highlights' => ['id' => ['Anti air, anti minyak, anti slip', 'ISO 9001:2015 dan CE', 'Model safety dan non safety', 'Logo bisa disesuaikan'], 'en' => ['Waterproof, oil resistant, anti-slip', 'ISO 9001:2015 and CE', 'Safety and non-safety models', 'Custom logo available']],
                'specs' => [['Material', 'Karet PVC'], ['Tinggi', '37–38 cm'], ['Ukuran', '38–44'], ['Warna', 'Hitam, kuning, army'], ['Standar', 'ISO 9001:2015, CE (model safety: EN 20345:2011, toe cap 200 J)']],
                'applications' => ['id' => ['Perkebunan', 'Pabrik'], 'en' => ['Plantations', 'Factories']],
                'solubility' => [], 'images' => ['sepatu-boots-hitam.jpg', 'sepatu-boots-kuning.jpg'],
            ],
            [
                'slug' => 'resiprene-35', 'code' => 'RSP-35', 'category' => 'resiprene',
                'name' => ['id' => 'Resiprene 35', 'en' => 'Resiprene 35'], 'kind' => 'Cyclised Natural Rubber',
                'aliases' => ['resiprine', 'respirine', 'resiprene 35', 'karet siklis', 'cyclised rubber'],
                'price_mode' => 'fixed', 'price' => 185000, 'price_usd' => 11.50, 'unit' => 'kg', 'moq' => 25, 'weight_gram' => 1000, 'length_cm' => 40, 'width_cm' => 30, 'height_cm' => 25, 'stock' => 1200,
                'summary' => ['id' => 'Karet alam tersiklisasi (cyclised natural rubber) berbentuk butiran padat berwarna kuning kecokelatan. Larut dalam pelarut tidak berbau, terutama aliphatic hydrocarbon dan campuran aromatic dengan aliphatic, dan larut sempurna dalam white spirit. Dipakai untuk coating pelindung dan perawatan, cat kapal, cat dan pernis, serta tinta cetak.', 'en' => 'Cyclised natural rubber in yellow-brown solid granules. It dissolves in odourless solvents, particularly aliphatic hydrocarbons and blends of aromatic and aliphatic solvents, and dissolves completely in white spirit. Used in protective and maintenance coatings, marine paints, paints and varnishes, and printing inks.'],
                'highlights' => ['id' => ['Cepat kering', 'Sangat tahan air', 'Tahan bahan kimia (alkali dan asam)', 'Adhesi sangat baik pada berbagai substrat'], 'en' => ['Fast drying', 'Highly water resistant', 'Chemical resistant (alkalis and acids)', 'Excellent adhesion to various substrates']],
                'specs' => [['Bentuk', 'Padatan butiran (granular), kuning kecokelatan'], ['Softening Point', '125–145 °C'], ['Viscosity', '18–24 detik (DIN 53211)'], ['Color', '11–13 Lovibond'], ['Acid Value', 'Maks. 5 mg KOH/g'], ['Density', '0,88–0,98 g/ml'], ['Appearance', 'Clear']],
                'applications' => ['id' => ['Coating pelindung', 'Cat kapal dan antifouling', 'Pelapis beton (baru dan lapuk)', 'Finishing tanpa bau', 'Cat, pernis, dan tinta cetak'], 'en' => ['Protective coatings', 'Marine and antifouling paints', 'Concrete coatings (fresh and weathered)', 'Odourless finishes', 'Paints, varnishes and printing inks']],
                'solubility' => [['White spirit', 'Sempurna'], ['Petroleum Solvent 100–140°C', 'Sempurna'], ['Aromatic Oil', 'Sempurna']],
                'images' => ['resiprene-35.jpg'],
            ],
            [
                'slug' => 'rubber-membrane', 'code' => 'IKN-PRD-003', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Membrane', 'en' => 'Rubber Membrane'], 'kind' => 'Rubber Articles',
                'aliases' => ['membran karet', 'rubber membrane', 'membrane filter press'],
                'price_mode' => 'quote', 'price' => null, 'stock_status' => Product::STOCK_MADE_TO_ORDER, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 2500, 'length_cm' => 40, 'width_cm' => 30, 'height_cm' => 15, 'stock' => 0,
                'summary' => ['id' => 'Membran karet untuk suku cadang peralatan, dibuat sesuai ukuran dan spesifikasi pelanggan. Kirim gambar teknik atau sampel untuk meminta penawaran.', 'en' => 'Rubber membrane for equipment spare parts, made to customer size and specification. Send an engineering drawing or a sample to request a quote.'],
                'highlights' => ['id' => ['Dibuat sesuai gambar teknik atau sampel', 'Ukuran sesuai permintaan'], 'en' => ['Made to engineering drawing or sample', 'Size made to order']],
                'specs' => [['Ukuran', 'Sesuai permintaan'], ['Spesifikasi', 'Sesuai gambar teknik atau sampel pelanggan']],
                'applications' => ['id' => ['Suku cadang peralatan'], 'en' => ['Equipment spare parts']],
                'solubility' => [], 'images' => ['rubber-membrane.jpg'],
            ],
            [
                'slug' => 'acting-rubber', 'code' => 'IKN-PRD-004', 'category' => 'rubber-articles',
                'name' => ['id' => 'Acting Rubber', 'en' => 'Acting Rubber'], 'kind' => 'Rubber Articles',
                'aliases' => ['acting rubber', 'karet acting', 'karet penggerak'],
                'price_mode' => 'fixed', 'price' => 450000, 'price_usd' => 28.00, 'unit' => 'pcs', 'moq' => 2, 'weight_gram' => 1800, 'length_cm' => 30, 'width_cm' => 30, 'height_cm' => 10, 'stock' => 120,
                'summary' => ['id' => 'Suku cadang karet untuk mesin, dibuat di pabrik Tanjung Morawa. Bentuk dan ukuran lain bisa dibuat sesuai spesifikasi pelanggan.', 'en' => 'Rubber spare part for machinery, made at the Tanjung Morawa plant. Other shapes and sizes can be made to customer specification.'],
                'highlights' => ['id' => ['Suku cadang mesin dari karet', 'Ukuran khusus sesuai permintaan'], 'en' => ['Rubber machine spare part', 'Custom sizes on request']],
                'specs' => [['Jenis', 'Suku cadang karet'], ['Ukuran khusus', 'Sesuai permintaan']],
                'applications' => ['id' => ['Mesin industri'], 'en' => ['Industrial machinery']],
                'solubility' => [], 'images' => ['acting-rubber.jpg'],
            ],
            [
                'slug' => 'rubber-ring', 'code' => 'IKN-PRD-005', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Ring', 'en' => 'Rubber Ring'], 'kind' => 'Rubber Articles',
                'aliases' => ['ring karet', 'rubber ring', 'o-ring', 'seal karet'],
                'price_mode' => 'fixed', 'price' => 35000, 'price_usd' => 2.20, 'unit' => 'pcs', 'moq' => 10, 'weight_gram' => 150, 'length_cm' => 15, 'width_cm' => 10, 'height_cm' => 3, 'stock' => 2000,
                'summary' => ['id' => 'Ring karet yang lunak dari campuran karet alam dan karet sintetis. Dipakai sebagai seal penutup pada sistem aliran cairan yang bekerja dengan tekanan. Tersedia dalam berbagai ukuran sesuai kebutuhan.', 'en' => 'Soft rubber ring made from a blend of natural and synthetic rubber. Used as a sealing ring in fluid systems that operate under pressure. Available in a range of sizes to suit your needs.'],
                'highlights' => ['id' => ['Campuran karet alam dan sintetis', 'Seal untuk sistem cairan bertekanan', 'Berbagai ukuran'], 'en' => ['Natural and synthetic rubber blend', 'Seal for pressurised fluid systems', 'Various sizes']],
                'specs' => [['Material', 'Campuran karet alam dan karet sintetis'], ['Fungsi', 'Seal penutup sistem cairan'], ['Ukuran', 'Sesuai kebutuhan']],
                'applications' => ['id' => ['Sistem aliran cairan', 'Perapat peralatan'], 'en' => ['Fluid systems', 'Equipment seals']],
                'solubility' => [], 'images' => ['rubber-ring.jpg'],
            ],
            [
                'slug' => 'sarung-kampak', 'code' => 'IKN-PRD-006', 'category' => 'rubber-articles',
                'name' => ['id' => 'Sarung Kampak', 'en' => 'Rubber Axe Sheath'], 'kind' => 'Rubber Articles',
                'aliases' => ['sarung kampak', 'sarung kapak', 'cover kampak', 'pelindung kampak'],
                'price_mode' => 'fixed', 'price' => 95000, 'price_usd' => 5.90, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 400, 'length_cm' => 20, 'width_cm' => 15, 'height_cm' => 6, 'stock' => 300,
                'summary' => ['id' => 'Sarung karet pelindung mata kampak untuk pekerja perkebunan. Termasuk lini alat pelindung diri (APD) dari pabrik Tanjung Morawa, bersama sarung dodos dan sarung egrek.', 'en' => 'Rubber sheath that protects the axe blade, for plantation workers. Part of the personal protective equipment (PPE) range from the Tanjung Morawa plant, alongside dodos and egrek sickle covers.'],
                'highlights' => ['id' => ['Menutup mata kampak', 'Lini APD perkebunan'], 'en' => ['Covers the axe blade', 'Plantation PPE range']],
                'specs' => [['Material', 'Karet'], ['Fungsi', 'Pelindung mata kampak']],
                'applications' => ['id' => ['Perkebunan'], 'en' => ['Plantations']],
                'solubility' => [], 'images' => ['sarung-kampak.jpg'],
            ],
            [
                'slug' => 'rubber-flange-packing', 'code' => 'IKN-PRD-007', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Flange Packing', 'en' => 'Rubber Flange Packing'], 'kind' => 'Rubber Articles',
                'aliases' => ['packing flange', 'gasket karet', 'flange gasket', 'packing karet'],
                'price_mode' => 'fixed', 'price' => 65000, 'price_usd' => 4.10, 'unit' => 'pcs', 'moq' => 5, 'weight_gram' => 300, 'length_cm' => 20, 'width_cm' => 15, 'height_cm' => 5, 'stock' => 800,
                'summary' => ['id' => 'Packing karet yang dipasang sebagai segel pada sambungan flange pipa. Tersedia dalam berbagai ukuran sesuai kebutuhan.', 'en' => 'Rubber packing fitted as a seal in pipe flange joints. Available in a range of sizes to suit your needs.'],
                'highlights' => ['id' => ['Segel sambungan flange', 'Ukuran sesuai kebutuhan'], 'en' => ['Seal for flange joints', 'Sizes to order']],
                'specs' => [['Material', 'Karet'], ['Fungsi', 'Segel sambungan flange'], ['Ukuran', 'Sesuai kebutuhan']],
                'applications' => ['id' => ['Perpipaan pabrik'], 'en' => ['Plant piping']],
                'solubility' => [], 'images' => ['rubber-flange-packing.jpg'],
            ],
            [
                'slug' => 'rubber-coupling', 'code' => 'IKN-PRD-008', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Coupling', 'en' => 'Rubber Coupling'], 'kind' => 'Rubber Articles',
                'aliases' => ['kopling karet', 'rubber coupling', 'coupling element'],
                'price_mode' => 'quote', 'price' => null, 'stock_status' => Product::STOCK_MADE_TO_ORDER, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 1200, 'length_cm' => 30, 'width_cm' => 20, 'height_cm' => 10, 'stock' => 0,
                'summary' => ['id' => 'Karet kopling untuk menghubungkan dua poros (shaft) dan menyalurkan gerak putar (torsi). Tersedia dalam berbagai bentuk dan ukuran, dibuat sesuai tipe kopling pelanggan.', 'en' => 'Rubber coupling that connects two shafts and transmits rotary motion (torque). Available in various shapes and sizes, made to the customer\'s coupling type.'],
                'highlights' => ['id' => ['Menghubungkan dua shaft', 'Menyalurkan torsi', 'Berbagai bentuk dan ukuran'], 'en' => ['Connects two shafts', 'Transmits torque', 'Various shapes and sizes']],
                'specs' => [['Fungsi', 'Penghubung dua shaft'], ['Tipe', 'Sesuai tipe kopling pelanggan']],
                'applications' => ['id' => ['Transmisi gerak mesin'], 'en' => ['Machine power transmission']],
                'solubility' => [], 'images' => ['rubber-coupling.jpg'],
            ],
            [
                'slug' => 'rubber-flexible-joint', 'code' => 'IKN-PRD-009', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Flexible Joint', 'en' => 'Rubber Flexible Joint'], 'kind' => 'Rubber Articles',
                'aliases' => ['flexible joint', 'expansion joint karet', 'sambungan fleksibel'],
                'price_mode' => 'quote', 'price' => null, 'stock_status' => Product::STOCK_MADE_TO_ORDER, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 6000, 'length_cm' => 60, 'width_cm' => 40, 'height_cm' => 20, 'stock' => 0,
                'summary' => ['id' => 'Penyambung pipa fleksibel dari karet yang melindungi jalur pipa dari tekanan dan getaran. Tersedia dalam berbagai ukuran.', 'en' => 'Flexible rubber pipe connector that protects pipelines from pressure and vibration. Available in a range of sizes.'],
                'highlights' => ['id' => ['Penyambung pipa fleksibel', 'Melindungi pipa dari tekanan dan getaran', 'Berbagai ukuran'], 'en' => ['Flexible pipe connector', 'Protects pipes from pressure and vibration', 'Various sizes']],
                'specs' => [['Fungsi', 'Penyambung pipa fleksibel'], ['Ukuran', 'Berbagai ukuran']],
                'applications' => ['id' => ['Perpipaan pabrik'], 'en' => ['Plant piping']],
                'solubility' => [], 'images' => ['rubber-flexible-joint.jpg'],
            ],
            [
                'slug' => 'packing-pintu-rebusan', 'code' => 'IKN-PRD-010', 'category' => 'rubber-articles',
                'name' => ['id' => 'Packing Pintu Rebusan', 'en' => 'Sterilizer Door Packing'], 'kind' => 'Rubber Articles',
                'aliases' => ['packing rebusan', 'packing sterilizer', 'sterilizer door seal', 'packing pintu sterilizer'],
                'price_mode' => 'fixed', 'price' => 1250000, 'price_usd' => 78.00, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 8000, 'length_cm' => 80, 'width_cm' => 50, 'height_cm' => 30, 'stock' => 40,
                'summary' => ['id' => 'Packing karet untuk pintu rebusan (sterilizer) pabrik kelapa sawit, tersedia tipe L, T, dan endless. Packing menahan uap panas di dalam rebusan sehingga perebusan buah sawit berjalan maksimal sebelum masuk tahap berikutnya. Panjang dibuat sesuai kebutuhan.', 'en' => 'Rubber packing for palm oil mill sterilizer doors, available in L, T and endless types. The packing keeps hot steam inside the sterilizer so the fruit is fully cooked before the next processing stage. Length is made to order.'],
                'highlights' => ['id' => ['Tipe L, T, dan endless', 'Sistem pengunci presisi', 'Mudah dipasang', 'Panjang sesuai kebutuhan'], 'en' => ['L, T and endless types', 'Precise locking system', 'Easy to fit', 'Length made to order']],
                'specs' => [['Tipe', 'L, T, endless (self energized rubber type)'], ['Tebal', '8–10 mm'], ['Lebar', '15–20 mm'], ['Tinggi', '20–37 mm'], ['Panjang', 'Sesuai kebutuhan'], ['Diameter rebusan horizontal', '2.100–3.200 mm']],
                'applications' => ['id' => ['Pabrik kelapa sawit'], 'en' => ['Palm oil mills']],
                'solubility' => [], 'images' => ['packing-pintu-rebusan.jpg'],
            ],
            [
                // Produk DRAF (belum terbit): contoh produk yang masih disiapkan admin, tidak tampil di katalog.
                'slug' => 'rubber-sheet', 'code' => 'IKN-PRD-012', 'category' => 'rubber-articles', 'is_published' => false,
                'name' => ['id' => 'Rubber Sheet (Lembaran Karet)', 'en' => 'Rubber Sheet'], 'kind' => 'Rubber Articles',
                'aliases' => ['rubber sheet', 'lembaran karet', 'karet lembaran', 'karet gulungan'],
                'price_mode' => 'fixed', 'price' => 285000, 'price_usd' => 17.80, 'unit' => 'm', 'moq' => 5, 'weight_gram' => 4500, 'length_cm' => 100, 'width_cm' => 100, 'height_cm' => 1, 'stock' => 60,
                'summary' => ['id' => 'Lembaran karet (packing lembaran) yang elastis dan anti air, tebal 3 sampai 12 mm dengan lebar 1.000 mm. Bisa dipakai sebagai packing atau bantalan mesin. Dijual per meter; ukuran lain dibuat sesuai kebutuhan.', 'en' => 'Elastic, water-resistant rubber sheet (sheet packing), 3 to 12 mm thick and 1,000 mm wide. Can be used as packing or as a machine pad. Sold per metre; other sizes made to order.'],
                'highlights' => ['id' => ['Tebal 3–12 mm, lebar 1.000 mm', 'Elastis dan anti air', 'Ukuran lain sesuai kebutuhan'], 'en' => ['3–12 mm thick, 1,000 mm wide', 'Elastic and water resistant', 'Other sizes to order']],
                'specs' => [['Tebal', '3–12 mm'], ['Lebar', '100 cm'], ['Sifat', 'Elastis, anti air']],
                'applications' => ['id' => ['Packing', 'Bantalan mesin'], 'en' => ['Packing', 'Machine pads']],
                'solubility' => [], 'images' => ['operating-rubber.jpg'],
            ],
            [
                'slug' => 'operating-rubber', 'code' => 'IKN-PRD-011', 'category' => 'rubber-articles',
                'name' => ['id' => 'Operating Rubber', 'en' => 'Operating Rubber'], 'kind' => 'Rubber Articles',
                'aliases' => ['operating rubber', 'karet operating', 'karet mesin'],
                'price_mode' => 'quote', 'price' => null, 'stock_status' => Product::STOCK_MADE_TO_ORDER, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 2000, 'length_cm' => 40, 'width_cm' => 30, 'height_cm' => 10, 'stock' => 0,
                'summary' => ['id' => 'Barang karet operasional dan suku cadang dalam berbagai bentuk dan ukuran. Dibuat sesuai spesifikasi khusus dari pelanggan; kirim sampel atau gambar teknik untuk meminta penawaran.', 'en' => 'Operating rubber goods and spare parts in various shapes and sizes. Made to the customer\'s own specification; send a sample or engineering drawing to request a quote.'],
                'highlights' => ['id' => ['Dibuat sesuai sampel atau gambar', 'Berbagai bentuk dan ukuran'], 'en' => ['Made to sample or drawing', 'Various shapes and sizes']],
                'specs' => [['Material', 'Karet alam / sintetis'], ['Bentuk dan ukuran', 'Sesuai permintaan']],
                'applications' => ['id' => ['Peralatan pabrik'], 'en' => ['Plant equipment']],
                'solubility' => [], 'images' => ['operating-rubber.jpg'],
            ],
        ];
    }
}
