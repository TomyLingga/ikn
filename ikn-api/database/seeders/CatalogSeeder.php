<?php

namespace Database\Seeders;

use App\Models\Category;
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
            ['slug' => 'resiprene', 'name' => ['id' => 'Resiprene', 'en' => 'Resiprene'], 'description' => ['id' => 'Cyclised natural rubber untuk protective coating & marine paint.', 'en' => 'Cyclised natural rubber for protective coatings and marine paints.'], 'sort_order' => 0],
            ['slug' => 'rubber-articles', 'name' => ['id' => 'Aneka Barang Karet', 'en' => 'Rubber Articles'], 'description' => ['id' => 'Komponen dan perlengkapan karet industri untuk berbagai sektor perkebunan dan pabrik.', 'en' => 'Industrial rubber components and equipment for plantation and factory sectors.'], 'sort_order' => 1],
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
                unset($row['category']);
                $product = Product::create($row + ['is_published' => true, 'is_taxable' => true]);
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

    /** Data produk: 3 dari mock + 9 dari foto di assets/products. Uang integer rupiah, berat gram realistis. */
    private function productRows(): array
    {
        return [
            [
                'slug' => 'sarung-egrek', 'code' => 'IKN-PRD-001', 'category' => 'rubber-articles',
                'name' => ['id' => 'Sarung Egrek', 'en' => 'Rubber Palm Sickle Cover'], 'kind' => 'Rubber Articles',
                'aliases' => ['sarung egrek', 'sarung pisau egrek', 'sarung egrek sawit', 'egrek', 'cover egrek'],
                'price_mode' => 'fixed', 'price' => 125000, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 350, 'length_cm' => 20, 'width_cm' => 15, 'height_cm' => 5, 'stock' => 500,
                'summary' => ['id' => 'Sarung pelindung pisau egrek kelapa sawit berbahan karet alam berkualitas tinggi untuk keselamatan kerja panen dan perlindungan mata pisau.', 'en' => 'Protective palm sickle cover made of high-grade natural rubber for harvesting safety and blade longevity.'],
                'highlights' => ['id' => ['Karet alam tebal & elastis', 'Pengait pengunci presisi & aman', 'Tahan benturan & sayatan pisau'], 'en' => ['Thick, elastic natural rubber', 'Precise and secure locking hook', 'Resistant to impact and blade cuts']],
                'specs' => [['Material', 'Karet Alam Tebal'], ['Fungsi', 'Pelindung Pisau Egrek Sawit'], ['Sistem Kancing', 'Klip Karet Fleksibel'], ['Aplikasi', 'Perkebunan Kelapa Sawit']],
                'applications' => ['id' => ['Perkebunan Kelapa Sawit', 'Keamanan Kerja Panen', 'Perlindungan Alat Perkebunan'], 'en' => ['Oil palm plantations', 'Harvesting safety', 'Plantation tool protection']],
                'solubility' => [], 'images' => ['sarung-egrek.jpg'],
            ],
            [
                'slug' => 'sepatu-boots', 'code' => 'IKN-PRD-002', 'category' => 'rubber-articles',
                'name' => ['id' => 'Sepatu Boots', 'en' => 'Industrial Rubber Boots'], 'kind' => 'Rubber Articles',
                'aliases' => ['sepatu boots', 'boots karet', 'sepatu boots industri', 'sepatu perkebunan', 'boots ptpn', 'rubin boots'],
                'price_mode' => 'fixed', 'price' => 170000, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 1800, 'length_cm' => 30, 'width_cm' => 20, 'height_cm' => 8, 'stock' => 350,
                'summary' => ['id' => 'Sepatu boots karet industri dan perkebunan standar mutu tinggi dengan logo Rubin PTPN. Tahan air, anti-slip, fleksibel, dan kuat di medan berat.', 'en' => 'High-standard industrial and plantation rubber boots branded Rubin PTPN. Waterproof, anti-slip, flexible, and built for heavy-duty field work.'],
                'highlights' => ['id' => ['Sol anti-slip berdaya cengkeram kuat', 'Tahan air & tahan lumpur', 'Nyaman digunakan seharian', 'Standar resmi Rubin & PTPN'], 'en' => ['High-grip anti-slip sole', 'Waterproof and mud resistant', 'Comfortable for all-day wear', 'Official Rubin & PTPN standard']],
                'specs' => [['Material', '100% Karet Alam / Lateks'], ['Tinggi', 'Tinggi Betis Standar Industri'], ['Fitur Sol', 'Deep Tread Anti-Slip'], ['Standar', 'Perkebunan & Industri']],
                'applications' => ['id' => ['Perkebunan Kelapa Sawit & Karet', 'Pabrik & Manufaktur Industri', 'Pertanian & Konstruksi'], 'en' => ['Oil palm and rubber plantations', 'Factories and manufacturing', 'Agriculture and construction']],
                'solubility' => [], 'images' => ['sepatu-boots-hitam.jpg', 'sepatu-boots-kuning.jpg'],
            ],
            [
                'slug' => 'resiprene-35', 'code' => 'RSP-35', 'category' => 'resiprene',
                'name' => ['id' => 'Resiprene 35', 'en' => 'Resiprene 35'], 'kind' => 'Cyclised Natural Rubber',
                'aliases' => ['resiprine', 'respirine', 'resiprene 35', 'karet siklis', 'cyclised rubber'],
                'price_mode' => 'fixed', 'price' => 185000, 'unit' => 'kg', 'moq' => 25, 'weight_gram' => 1000, 'length_cm' => 40, 'width_cm' => 30, 'height_cm' => 25, 'stock' => 1200,
                'summary' => ['id' => 'Karet alam tersiklisasi dalam bentuk padatan/serpihan kristal amber dengan kelarutan sangat baik pada pelarut tak berbau. Bahan andalan untuk cat pelindung, coating perawatan, dan cat marine.', 'en' => 'Cyclised natural rubber in amber crystal solid/flake form with excellent solubility in odourless solvents. A key material for protective coatings, maintenance coatings, and marine paints.'],
                'highlights' => ['id' => ['Cepat kering', 'Sangat tahan air', 'Tahan kimia (alkali & asam)', 'Adhesi baik ke beragam substrat'], 'en' => ['Fast drying', 'Highly water resistant', 'Chemical resistant (alkali & acid)', 'Good adhesion to various substrates']],
                'specs' => [['Bentuk', 'Padatan / Serpihan Amber'], ['Softening Point', '125–145 °C'], ['Viscosity', '18–24 detik (DIN 53211)'], ['Color', '11–13 Lovibond'], ['Acid Value', 'Maks. 5 mg KOH/g'], ['Density', '0,88–0,98 g/ml'], ['Appearance', 'Clear']],
                'applications' => ['id' => ['Protective coatings', 'Cat kapal / anti-fouling', 'Concrete coating (baru & lapuk)', 'Odor-free finishing'], 'en' => ['Protective coatings', 'Marine / anti-fouling paints', 'Concrete coating (new & weathered)', 'Odour-free finishing']],
                'solubility' => [['White spirit', 'Sempurna'], ['Petroleum Solvent 100–140°C', 'Sempurna'], ['Aromatic Oil', 'Sempurna']],
                'images' => ['resiprene-35.jpg'],
            ],
            [
                'slug' => 'rubber-membrane', 'code' => 'IKN-PRD-003', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Membrane', 'en' => 'Rubber Membrane'], 'kind' => 'Rubber Articles',
                'aliases' => ['membran karet', 'rubber membrane', 'membrane filter press'],
                'price_mode' => 'quote', 'price' => null, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 2500, 'length_cm' => 40, 'width_cm' => 30, 'height_cm' => 15, 'stock' => 0,
                'summary' => ['id' => 'Membran karet untuk filter press dan peralatan proses; dibuat sesuai ukuran dan spesifikasi pelanggan.', 'en' => 'Rubber membrane for filter presses and process equipment; made to customer size and specification.'],
                'highlights' => ['id' => ['Dibuat sesuai gambar teknik', 'Tahan tekanan dan abrasi', 'Kompon karet alam/sintetis sesuai kebutuhan'], 'en' => ['Made to engineering drawing', 'Pressure and abrasion resistant', 'Natural or synthetic compound as required']],
                'specs' => [['Material', 'Karet Alam / NBR / EPDM'], ['Kekerasan', '50–70 Shore A'], ['Ukuran', 'Custom']],
                'applications' => ['id' => ['Filter press pabrik kelapa sawit', 'Industri pengolahan'], 'en' => ['Palm oil mill filter presses', 'Process industries']],
                'solubility' => [], 'images' => ['rubber-membrane.jpg'],
            ],
            [
                'slug' => 'acting-rubber', 'code' => 'IKN-PRD-004', 'category' => 'rubber-articles',
                'name' => ['id' => 'Acting Rubber', 'en' => 'Acting Rubber'], 'kind' => 'Rubber Articles',
                'aliases' => ['acting rubber', 'karet acting', 'karet penggerak'],
                'price_mode' => 'fixed', 'price' => 450000, 'unit' => 'pcs', 'moq' => 2, 'weight_gram' => 1800, 'length_cm' => 30, 'width_cm' => 30, 'height_cm' => 10, 'stock' => 120,
                'summary' => ['id' => 'Komponen karet penggerak untuk mesin pabrik kelapa sawit, dicetak dari kompon karet alam tahan aus.', 'en' => 'Rubber actuating component for palm oil mill machinery, moulded from wear-resistant natural rubber compound.'],
                'highlights' => ['id' => ['Tahan aus dan panas', 'Dimensi presisi', 'Umur pakai panjang'], 'en' => ['Wear and heat resistant', 'Precise dimensions', 'Long service life']],
                'specs' => [['Material', 'Karet Alam Kompon'], ['Kekerasan', '60–65 Shore A'], ['Aplikasi', 'Mesin PKS']],
                'applications' => ['id' => ['Pabrik kelapa sawit', 'Mesin industri'], 'en' => ['Palm oil mills', 'Industrial machinery']],
                'solubility' => [], 'images' => ['acting-rubber.jpg'],
            ],
            [
                'slug' => 'rubber-ring', 'code' => 'IKN-PRD-005', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Ring', 'en' => 'Rubber Ring'], 'kind' => 'Rubber Articles',
                'aliases' => ['ring karet', 'rubber ring', 'o-ring', 'seal karet'],
                'price_mode' => 'fixed', 'price' => 35000, 'unit' => 'pcs', 'moq' => 10, 'weight_gram' => 150, 'length_cm' => 15, 'width_cm' => 10, 'height_cm' => 3, 'stock' => 2000,
                'summary' => ['id' => 'Ring karet untuk sambungan pipa dan perapat peralatan industri, tersedia dalam berbagai diameter.', 'en' => 'Rubber ring for pipe joints and industrial equipment seals, available in a range of diameters.'],
                'highlights' => ['id' => ['Elastisitas tinggi', 'Tahan minyak dan air', 'Berbagai ukuran'], 'en' => ['High elasticity', 'Oil and water resistant', 'Various sizes']],
                'specs' => [['Material', 'NBR / Karet Alam'], ['Kekerasan', '65–70 Shore A'], ['Diameter', '2–24 inci']],
                'applications' => ['id' => ['Perpipaan', 'Perapat mesin'], 'en' => ['Piping', 'Machine seals']],
                'solubility' => [], 'images' => ['rubber-ring.jpg'],
            ],
            [
                'slug' => 'sarung-kampak', 'code' => 'IKN-PRD-006', 'category' => 'rubber-articles',
                'name' => ['id' => 'Sarung Kampak', 'en' => 'Rubber Axe Sheath'], 'kind' => 'Rubber Articles',
                'aliases' => ['sarung kampak', 'sarung kapak', 'cover kampak', 'pelindung kampak'],
                'price_mode' => 'fixed', 'price' => 95000, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 400, 'length_cm' => 20, 'width_cm' => 15, 'height_cm' => 6, 'stock' => 300,
                'summary' => ['id' => 'Sarung pelindung mata kampak dari karet alam tebal untuk keselamatan pekerja perkebunan.', 'en' => 'Thick natural rubber protective sheath for axe blades, for plantation worker safety.'],
                'highlights' => ['id' => ['Karet alam tebal', 'Pas di berbagai ukuran mata kampak', 'Tahan sayatan'], 'en' => ['Thick natural rubber', 'Fits various axe blade sizes', 'Cut resistant']],
                'specs' => [['Material', 'Karet Alam Tebal'], ['Fungsi', 'Pelindung Mata Kampak']],
                'applications' => ['id' => ['Perkebunan', 'Kehutanan'], 'en' => ['Plantations', 'Forestry']],
                'solubility' => [], 'images' => ['sarung-kampak.jpg'],
            ],
            [
                'slug' => 'rubber-flange-packing', 'code' => 'IKN-PRD-007', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Flange Packing', 'en' => 'Rubber Flange Packing'], 'kind' => 'Rubber Articles',
                'aliases' => ['packing flange', 'gasket karet', 'flange gasket', 'packing karet'],
                'price_mode' => 'fixed', 'price' => 65000, 'unit' => 'pcs', 'moq' => 5, 'weight_gram' => 300, 'length_cm' => 20, 'width_cm' => 15, 'height_cm' => 5, 'stock' => 800,
                'summary' => ['id' => 'Packing karet untuk sambungan flange pipa, mencegah kebocoran pada sistem uap, air, dan minyak.', 'en' => 'Rubber packing for pipe flange joints, preventing leaks in steam, water, and oil systems.'],
                'highlights' => ['id' => ['Tahan tekanan', 'Tahan suhu hingga 120 °C', 'Ukuran standar ANSI/JIS'], 'en' => ['Pressure resistant', 'Withstands up to 120 °C', 'ANSI/JIS standard sizes']],
                'specs' => [['Material', 'Karet Alam / EPDM'], ['Ketebalan', '3–6 mm'], ['Standar', 'ANSI / JIS']],
                'applications' => ['id' => ['Perpipaan pabrik', 'Instalasi uap'], 'en' => ['Plant piping', 'Steam installations']],
                'solubility' => [], 'images' => ['rubber-flange-packing.jpg'],
            ],
            [
                'slug' => 'rubber-coupling', 'code' => 'IKN-PRD-008', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Coupling', 'en' => 'Rubber Coupling'], 'kind' => 'Rubber Articles',
                'aliases' => ['kopling karet', 'rubber coupling', 'coupling element'],
                'price_mode' => 'quote', 'price' => null, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 1200, 'length_cm' => 30, 'width_cm' => 20, 'height_cm' => 10, 'stock' => 0,
                'summary' => ['id' => 'Elemen kopling karet peredam getaran untuk transmisi daya motor dan pompa; dibuat sesuai tipe kopling.', 'en' => 'Vibration-damping rubber coupling element for motor and pump power transmission; made to coupling type.'],
                'highlights' => ['id' => ['Meredam getaran dan kejut', 'Sesuai tipe kopling', 'Kompon tahan minyak'], 'en' => ['Absorbs vibration and shock', 'Matched to coupling type', 'Oil-resistant compound']],
                'specs' => [['Material', 'NBR / Karet Alam'], ['Kekerasan', '70–80 Shore A'], ['Tipe', 'Custom']],
                'applications' => ['id' => ['Pompa dan motor industri'], 'en' => ['Industrial pumps and motors']],
                'solubility' => [], 'images' => ['rubber-coupling.jpg'],
            ],
            [
                'slug' => 'rubber-flexible-joint', 'code' => 'IKN-PRD-009', 'category' => 'rubber-articles',
                'name' => ['id' => 'Rubber Flexible Joint', 'en' => 'Rubber Flexible Joint'], 'kind' => 'Rubber Articles',
                'aliases' => ['flexible joint', 'expansion joint karet', 'sambungan fleksibel'],
                'price_mode' => 'quote', 'price' => null, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 6000, 'length_cm' => 60, 'width_cm' => 40, 'height_cm' => 20, 'stock' => 0,
                'summary' => ['id' => 'Sambungan fleksibel karet untuk meredam getaran dan pemuaian pada jalur pipa industri.', 'en' => 'Rubber flexible joint absorbing vibration and thermal expansion in industrial pipelines.'],
                'highlights' => ['id' => ['Meredam getaran pompa', 'Menyerap pemuaian pipa', 'Flange sesuai standar'], 'en' => ['Absorbs pump vibration', 'Accommodates pipe expansion', 'Standard flange pattern']],
                'specs' => [['Material', 'Karet Alam / EPDM dengan penguat'], ['Diameter', '2–12 inci'], ['Tekanan kerja', 'Hingga 10 bar']],
                'applications' => ['id' => ['Perpipaan pabrik', 'Instalasi pompa'], 'en' => ['Plant piping', 'Pump installations']],
                'solubility' => [], 'images' => ['rubber-flexible-joint.jpg'],
            ],
            [
                'slug' => 'packing-pintu-rebusan', 'code' => 'IKN-PRD-010', 'category' => 'rubber-articles',
                'name' => ['id' => 'Packing Pintu Rebusan', 'en' => 'Sterilizer Door Packing'], 'kind' => 'Rubber Articles',
                'aliases' => ['packing rebusan', 'packing sterilizer', 'sterilizer door seal', 'packing pintu sterilizer'],
                'price_mode' => 'fixed', 'price' => 1250000, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 8000, 'length_cm' => 80, 'width_cm' => 50, 'height_cm' => 30, 'stock' => 40,
                'summary' => ['id' => 'Packing karet pintu rebusan (sterilizer) pabrik kelapa sawit, tahan uap bertekanan dan suhu tinggi.', 'en' => 'Rubber packing for palm oil mill sterilizer doors, resistant to pressurised steam and high temperature.'],
                'highlights' => ['id' => ['Tahan uap 3 bar / 140 °C', 'Profil presisi sesuai pintu', 'Umur pakai panjang'], 'en' => ['Withstands 3 bar / 140 °C steam', 'Precise profile to door', 'Long service life']],
                'specs' => [['Material', 'Kompon karet tahan panas'], ['Kekerasan', '55–65 Shore A'], ['Diameter pintu', '2,1–2,7 m']],
                'applications' => ['id' => ['Pabrik kelapa sawit'], 'en' => ['Palm oil mills']],
                'solubility' => [], 'images' => ['packing-pintu-rebusan.jpg'],
            ],
            [
                'slug' => 'operating-rubber', 'code' => 'IKN-PRD-011', 'category' => 'rubber-articles',
                'name' => ['id' => 'Operating Rubber', 'en' => 'Operating Rubber'], 'kind' => 'Rubber Articles',
                'aliases' => ['operating rubber', 'karet operating', 'karet mesin'],
                'price_mode' => 'quote', 'price' => null, 'unit' => 'pcs', 'moq' => 1, 'weight_gram' => 2000, 'length_cm' => 40, 'width_cm' => 30, 'height_cm' => 10, 'stock' => 0,
                'summary' => ['id' => 'Komponen karet operasional untuk peralatan pabrik dan alat berat, dicetak sesuai spesifikasi pelanggan.', 'en' => 'Operating rubber component for plant equipment and heavy machinery, moulded to customer specification.'],
                'highlights' => ['id' => ['Dibuat sesuai sampel/gambar', 'Kompon tahan aus', 'Kontrol mutu per batch'], 'en' => ['Made to sample or drawing', 'Wear-resistant compound', 'Batch quality control']],
                'specs' => [['Material', 'Karet Alam / Sintetis'], ['Kekerasan', 'Sesuai permintaan']],
                'applications' => ['id' => ['Peralatan pabrik', 'Alat berat'], 'en' => ['Plant equipment', 'Heavy machinery']],
                'solubility' => [], 'images' => ['operating-rubber.jpg'],
            ],
        ];
    }
}
