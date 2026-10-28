<?php

namespace Database\Seeders;

use App\Models\Brochure;
use App\Models\Certificate;
use App\Models\CustomerLogo;
use App\Models\DocLink;
use App\Models\GalleryItem;
use App\Models\Post;
use App\Models\PostCategory;
use Illuminate\Database\Seeder;

// Berita, galeri, sertifikat, brosur, logo pelanggan, doc-links dari mock-data.ts dan site.ts.
class ContentSeeder extends Seeder
{
    public function run()
    {
        $this->posts();
        $this->gallery();
        $this->certificates();
        $this->brochures();
        $this->logos();
        $this->docLinks();
    }

    private function posts(): void
    {
        // Kategori berita (tabel post_categories); berita demo memakai slug kategori di bawah.
        $categories = [
            'berita-perusahaan' => ['Berita Perusahaan', 'Company News'],
            'produk' => ['Produk', 'Products'],
            'kemitraan' => ['Kemitraan', 'Partnerships'],
            'kegiatan' => ['Kegiatan', 'Events'],
        ];
        $position = 0;
        foreach ($categories as $slug => [$id, $en]) {
            PostCategory::firstOrCreate(['slug' => $slug], ['name' => ['id' => $id, 'en' => $en], 'sort_order' => $position++]);
        }

        // Berita demo hanya memakai fakta yang ada di data situs (katalog, sertifikat, alur pemesanan, nilai AKHLAK).
        $posts = [
            [
                'slug' => 'cara-memesan-produk-karet-online', 'category' => 'berita-perusahaan', 'published_at' => '2026-10-05', 'cover' => 'kantor-direksi.png',
                'title' => ['id' => 'Cara memesan Resiprene 35 dan barang karet PT IKN secara online', 'en' => 'How to order Resiprene 35 and rubber goods from PT IKN online'],
                'excerpt' => [
                    'id' => 'Pelanggan perusahaan bisa melihat harga, memesan, membayar, dan melacak kiriman langsung dari situs PT IKN. Berikut langkahnya dari pendaftaran sampai barang diterima.',
                    'en' => 'Business customers can see prices, order, pay and track deliveries directly on the PT IKN website. Here are the steps from sign-up to delivery.',
                ],
                'body' => [
                    'id' => '<h2>1. Daftarkan akun perusahaan</h2><p>Isi nama PIC, email, nama perusahaan, jabatan, nomor telepon, dan NPWP di halaman daftar. Kami mengirim tautan verifikasi ke email Anda, lalu tim kami memeriksa data pendaftaran. Checkout terbuka setelah akun disetujui.</p>'
                        .'<h2>2. Pilih produk</h2><p>Harga, stok, dan minimum order tampil di katalog setelah login. Produk bertanda Penawaran, misalnya membran filter press atau kopling karet, dibuat sesuai gambar teknik; kirim kebutuhannya lewat formulir kontak, live chat, atau WhatsApp.</p>'
                        .'<h2>3. Checkout dan pengiriman</h2><p>Pilih alamat pengiriman dan tandai lokasinya di peta. Ongkir dihitung dari zona alamat, jarak dari pabrik, berat, dan volume kiriman, lalu Anda memilih layanan pengiriman yang tersedia.</p>'
                        .'<h2>4. Pembayaran</h2><p>Bayar dengan transfer bank ke rekening perusahaan atau dengan QRIS, lalu unggah bukti pembayaran di halaman pesanan. Invoice terbit setelah pembayaran diverifikasi. Faktur pajak dan surat jalan diunggah tim kami ke halaman pesanan yang sama.</p>'
                        .'<h2>5. Lacak sampai diterima</h2><p>Nomor resi dan catatan perjalanan kiriman tampil di dashboard. Setelah barang tiba, tandai pesanan diterima, selesaikan pesanan, dan beri ulasan produk.</p>'
                        .'<p><a href="/catalog">Buka katalog produk</a> atau baca <a href="/bisnis#tanya-jawab">tanya jawab pemesanan</a>.</p>',
                    'en' => '<h2>1. Register a company account</h2><p>Enter the contact name, email, company name, position, phone number and tax ID on the sign-up page. We send a verification link to your email, then our team reviews the registration. Checkout opens once the account is approved.</p>'
                        .'<h2>2. Choose products</h2><p>Prices, stock and minimum order quantities show in the catalog after login. Products marked Quote, such as filter press membranes or rubber couplings, are made to your engineering drawing; send your requirements through the contact form, live chat or WhatsApp.</p>'
                        .'<h2>3. Checkout and delivery</h2><p>Choose a delivery address and pin it on the map. Shipping is calculated from the address zone, distance from the plant, weight and volume, and you pick one of the available delivery services.</p>'
                        .'<h2>4. Payment</h2><p>Pay by bank transfer to the company account or by QRIS, then upload the payment proof on the order page. The invoice is issued once the payment is verified. Our team uploads the tax invoice and delivery note to the same order page.</p>'
                        .'<h2>5. Track until delivery</h2><p>The tracking number and shipment notes show in your dashboard. When the goods arrive, mark the order as received, complete it and review the products.</p>'
                        .'<p><a href="/catalog">Open the product catalog</a> or read the <a href="/bisnis#tanya-jawab">ordering FAQ</a>.</p>',
                ],
            ],
            [
                'slug' => 'mengenal-resiprene-35-karet-siklis', 'category' => 'produk', 'published_at' => '2026-09-15', 'cover' => 'resiprene-35.jpg',
                'title' => ['id' => 'Mengenal Resiprene 35, karet alam tersiklisasi untuk cat dan coating', 'en' => 'Resiprene 35 explained: cyclised natural rubber for paints and coatings'],
                'excerpt' => [
                    'id' => 'Resiprene 35 adalah karet alam tersiklisasi berbentuk serpihan kristal amber buatan pabrik Sei Bamban. Ini spesifikasi, kelarutan, dan aplikasinya.',
                    'en' => 'Resiprene 35 is cyclised natural rubber in amber crystal flakes made at the Sei Bamban plant. Here are its specifications, solubility and applications.',
                ],
                'body' => [
                    'id' => '<h2>Spesifikasi</h2><ul><li>Bentuk: padatan atau serpihan amber</li><li>Softening point: 125 sampai 145 °C</li><li>Viskositas: 18 sampai 24 detik (DIN 53211)</li><li>Warna: 11 sampai 13 Lovibond</li><li>Acid value: maksimal 5 mg KOH/g</li><li>Densitas: 0,88 sampai 0,98 g/ml</li></ul>'
                        .'<h2>Kelarutan</h2><p>Resiprene 35 larut sempurna dalam white spirit, pelarut petroleum 100 sampai 140 °C, dan aromatic oil, sehingga cocok untuk cat berbasis pelarut, termasuk formula yang memakai pelarut tak berbau. Lapisannya cepat kering, tahan air, tahan alkali dan asam, serta melekat baik pada beragam substrat.</p>'
                        .'<h2>Aplikasi</h2><ul><li>Protective coating</li><li>Cat kapal dan anti-fouling</li><li>Coating beton baru maupun lapuk</li><li>Finishing tanpa bau</li></ul>'
                        .'<h2>Pemesanan dan dokumen</h2><p>Resiprene 35 dijual per kilogram dengan minimum order 25 kg. Brosur spesifikasi dan safety data sheet tersedia di <a href="/bisnis#unduhan">halaman Bisnis</a>, dan sertifikat REACH ada di <a href="/keberlanjutan#sertifikat">halaman Keberlanjutan</a>. Harga dan stok terbaru ada di <a href="/catalog/resiprene-35">halaman produk Resiprene 35</a>.</p>',
                    'en' => '<h2>Specifications</h2><ul><li>Form: amber solid or flakes</li><li>Softening point: 125 to 145 °C</li><li>Viscosity: 18 to 24 seconds (DIN 53211)</li><li>Colour: 11 to 13 Lovibond</li><li>Acid value: max. 5 mg KOH/g</li><li>Density: 0.88 to 0.98 g/ml</li></ul>'
                        .'<h2>Solubility</h2><p>Resiprene 35 dissolves fully in white spirit, petroleum solvent 100 to 140 °C and aromatic oil, which suits solvent-based paints, including odourless-solvent formulas. Films dry fast, resist water, alkali and acid, and adhere well to a range of substrates.</p>'
                        .'<h2>Applications</h2><ul><li>Protective coatings</li><li>Marine and anti-fouling paints</li><li>Coatings for new and weathered concrete</li><li>Odour-free finishes</li></ul>'
                        .'<h2>Ordering and documents</h2><p>Resiprene 35 is sold per kilogram with a 25 kg minimum order. The specification brochure and safety data sheet are on the <a href="/bisnis#unduhan">Business page</a>, and the REACH certificate is on the <a href="/keberlanjutan#sertifikat">Sustainability page</a>. See current price and stock on the <a href="/catalog/resiprene-35">Resiprene 35 product page</a>.</p>',
                ],
            ],
            [
                'slug' => 'sarung-egrek-karet-panen-sawit', 'category' => 'produk', 'published_at' => '2026-08-20', 'cover' => 'karet-1-1-scaled.jpg',
                'title' => ['id' => 'Sarung egrek karet untuk keselamatan panen kelapa sawit', 'en' => 'Rubber sickle covers for safer oil palm harvesting'],
                'excerpt' => [
                    'id' => 'Mata pisau egrek yang terbuka bisa melukai pemanen saat egrek dibawa antar blok. Sarung egrek karet PT IKN menutup mata pisau dengan klip pengunci.',
                    'en' => 'An exposed sickle blade can injure harvesters while it is carried between blocks. PT IKN rubber sickle covers close over the blade with a locking clip.',
                ],
                'body' => [
                    'id' => '<p>Egrek adalah pisau bergagang panjang untuk memanen tandan buah segar kelapa sawit. Sarung egrek produksi pabrik Tanjung Morawa dibuat dari karet alam tebal yang elastis, tahan benturan, dan tahan sayatan pisau. Klip karet fleksibelnya mengunci sarung pada mata pisau sehingga tidak mudah lepas saat dibawa.</p>'
                        .'<h2>Untuk siapa</h2><p>Sarung egrek dipakai di perkebunan kelapa sawit, baik untuk keselamatan kerja panen maupun untuk melindungi mata pisau saat disimpan. Untuk perlengkapan kerja kebun lain, PT IKN juga membuat sarung kampak dan sepatu boots karet berlogo Rubin PTPN.</p>'
                        .'<h2>Pemesanan</h2><p>Sarung egrek dijual per buah dengan minimum order satu buah, sehingga bisa dipesan bersama sarung kampak dan sepatu boots dalam satu pesanan. <a href="/catalog/sarung-egrek">Lihat harga dan stok sarung egrek</a>.</p>',
                    'en' => '<p>An egrek is a long-handled knife used to harvest oil palm fruit bunches. The sickle covers made at the Tanjung Morawa plant use thick, elastic natural rubber that resists impact and blade cuts. A flexible rubber clip locks the cover onto the blade so it stays on while carried.</p>'
                        .'<h2>Who uses it</h2><p>Oil palm estates use sickle covers for harvesting safety and to protect the blade in storage. For other field gear, PT IKN also makes axe sheaths and Rubin PTPN rubber boots.</p>'
                        .'<h2>Ordering</h2><p>Sickle covers are sold per piece with a one-piece minimum, so you can order them together with axe sheaths and boots. <a href="/catalog/sarung-egrek">See sickle cover price and stock</a>.</p>',
                ],
            ],
            [
                'slug' => 'resiprene-35-terdaftar-reach-uni-eropa', 'category' => 'produk', 'published_at' => '2026-07-10', 'cover' => 'produksi-karet-1.webp',
                'title' => ['id' => 'Resiprene 35 memenuhi registrasi REACH untuk pasar Uni Eropa', 'en' => 'Resiprene 35 meets REACH registration for the EU market'],
                'excerpt' => [
                    'id' => 'Resiprene produksi PT Industri Karet Nusantara telah memenuhi persyaratan registrasi REACH, regulasi Uni Eropa tentang keamanan bahan kimia.',
                    'en' => 'Resiprene made by PT Industri Karet Nusantara meets the registration requirements of REACH, the European Union regulation on chemical safety.',
                ],
                'body' => [
                    'id' => '<p>REACH adalah singkatan dari Registration, Evaluation, Authorisation and Restriction of Chemicals. Bahan kimia yang dipasarkan di Uni Eropa harus terdaftar sesuai regulasi ini. Dengan registrasi REACH, Resiprene dapat dipasok ke produsen coating dan cat kapal di Uni Eropa.</p>'
                        .'<p>Sertifikat registrasi REACH bisa diunduh di <a href="/keberlanjutan#reach">halaman Keberlanjutan</a>. Safety data sheet Resiprene 35 tersedia di bagian <a href="/bisnis#unduhan">Unduhan</a>.</p>',
                    'en' => '<p>REACH stands for Registration, Evaluation, Authorisation and Restriction of Chemicals. Chemicals sold in the European Union must be registered under it. With REACH registration, Resiprene can be supplied to coating and marine paint makers in the EU.</p>'
                        .'<p>Download the REACH registration certificate on the <a href="/keberlanjutan#reach">Sustainability page</a>. The Resiprene 35 safety data sheet is in the <a href="/bisnis#unduhan">Downloads</a> section.</p>',
                ],
            ],
            [
                'slug' => 'nilai-akhlak-sdm', 'category' => 'berita-perusahaan', 'published_at' => '2026-05-02', 'cover' => 'pabrik-2-1.png',
                'title' => ['id' => 'Enam nilai AKHLAK yang menjadi pedoman kerja di PT IKN', 'en' => 'The six AKHLAK values that guide work at PT IKN'],
                'excerpt' => [
                    'id' => 'AKHLAK adalah singkatan dari Amanah, Kompeten, Harmonis, Loyal, Adaptif, dan Kolaboratif. Ini arti tiap nilai bagi insan PT Industri Karet Nusantara.',
                    'en' => 'AKHLAK stands for Amanah, Kompeten, Harmonis, Loyal, Adaptif and Kolaboratif. Here is what each value means for the people of PT Industri Karet Nusantara.',
                ],
                'body' => [
                    'id' => '<ul><li>Amanah: memegang teguh kepercayaan yang diberikan.</li><li>Kompeten: terus belajar dan mengembangkan kapabilitas.</li><li>Harmonis: saling peduli dan menghargai perbedaan.</li><li>Loyal: berdedikasi dan mengutamakan kepentingan bersama.</li><li>Adaptif: terus berinovasi menghadapi perubahan.</li><li>Kolaboratif: membangun kerja sama yang sinergis.</li></ul>'
                        .'<p>Nilai-nilai ini juga tercantum di <a href="/tentang#nilai">halaman Tentang Kami</a>, bersama visi, misi, dan struktur organisasi perusahaan.</p>',
                    'en' => '<ul><li>Amanah (trust): holding firmly to the trust given.</li><li>Kompeten (competence): continuously learning and developing capabilities.</li><li>Harmonis (harmony): caring for one another and respecting differences.</li><li>Loyal (loyalty): dedicated and putting shared interests first.</li><li>Adaptif (adaptability): continuously innovating in the face of change.</li><li>Kolaboratif (collaboration): building synergistic cooperation.</li></ul>'
                        .'<p>The values also appear on the <a href="/tentang#nilai">About Us page</a>, together with the company vision, mission and organisation structure.</p>',
                ],
            ],
            [
                // Berita DRAF: contoh artikel yang masih disunting admin, belum tampil di situs.
                'slug' => 'program-beasiswa-anak-karyawan-2026', 'category' => 'kegiatan', 'published_at' => '2026-10-20', 'cover' => 'kantor-direksi.png', 'is_published' => false,
                'body' => [
                    'id' => '<h2>Pendaftaran dibuka 1 November</h2><p>Program beasiswa untuk anak karyawan berprestasi jenjang SMA dan perguruan tinggi. Syarat dan formulir akan diumumkan melalui HRD.</p>',
                    'en' => '<h2>Registration opens 1 November</h2><p>Scholarship programme for high-achieving children of employees at senior high school and university level. Requirements and forms will be announced through HR.</p>',
                ],
                'title' => ['id' => 'PT IKN membuka program beasiswa anak karyawan 2026', 'en' => 'PT IKN opens the 2026 employee children scholarship programme'],
                'excerpt' => ['id' => 'Draf pengumuman program beasiswa; menunggu persetujuan manajemen sebelum terbit.', 'en' => 'Draft scholarship announcement; awaiting management approval before publishing.'],
            ],
        ];

        foreach ($posts as $post) {
            Post::firstOrCreate(['slug' => $post['slug']], [
                'title' => $post['title'],
                'excerpt' => $post['excerpt'],
                'body' => [
                    'id' => '<p>'.$post['excerpt']['id'].'</p>'.($post['body']['id'] ?? ''),
                    'en' => '<p>'.$post['excerpt']['en'].'</p>'.($post['body']['en'] ?? ''),
                ],
                'category_id' => PostCategory::where('slug', $post['category'])->value('id'),
                'author' => 'Humas PT IKN',
                'cover_media_id' => MediaSeeder::id($post['cover']),
                'is_published' => $post['is_published'] ?? true,
                'published_at' => ($post['is_published'] ?? true) ? $post['published_at'].' 09:00:00' : null,
            ]);
        }
    }

    private function gallery(): void
    {
        if (GalleryItem::count() > 0) {
            return;
        }

        $images = [
            ['kantor-direksi.png', 'Kantor Direksi PT IKN', 'PT IKN Head Office'],
            ['karet-1-1-scaled.jpg', 'Pengolahan Karet Alam', 'Natural Rubber Processing'],
            ['pabrik-2-1.png', 'Kompleks Pabrik Hilir', 'Downstream Plant Complex'],
            ['produksi-karet-1.webp', 'Aktivitas Pemotongan Slab Karet', 'Rubber Slab Cutting Activity'],
        ];
        foreach ($images as $i => [$file, $id, $en]) {
            GalleryItem::create([
                'title' => ['id' => $id, 'en' => $en], 'type' => GalleryItem::TYPE_IMAGE,
                'media_id' => MediaSeeder::id($file), 'is_published' => true, 'sort_order' => $i,
            ]);
        }

        $videos = [
            ['FGJQW6l2hrk', 'Company Profile PT Industri Karet Nusantara', 'PT Industri Karet Nusantara company profile'],
        ];
        foreach ($videos as $i => [$youtube, $id, $en]) {
            GalleryItem::create([
                'title' => ['id' => $id, 'en' => $en], 'type' => GalleryItem::TYPE_VIDEO,
                'external_url' => $youtube, 'is_published' => true, 'sort_order' => 10 + $i,
            ]);
        }
    }

    private function certificates(): void
    {
        if (Certificate::count() > 0) {
            return;
        }

        Certificate::create([
            'name' => ['id' => 'ISO 37001:2016', 'en' => 'ISO 37001:2016'],
            'material' => ['id' => 'Sistem Manajemen Anti Penyuapan (SMAP)', 'en' => 'Anti-Bribery Management System (ABMS)'],
            'description' => ['id' => 'Sertifikasi kepatuhan anti-penyuapan berstandar internasional.', 'en' => 'International-standard anti-bribery compliance certification.'],
            'media_id' => MediaSeeder::id('iso-37001.pdf'), 'is_published' => true, 'sort_order' => 0,
        ]);
        Certificate::create([
            'name' => ['id' => 'REACH Compliance', 'en' => 'REACH Compliance'],
            'material' => ['id' => 'European Chemicals Agency (ECHA)', 'en' => 'European Chemicals Agency (ECHA)'],
            'description' => ['id' => 'Kepatuhan ekspor bahan kimia dan polimer ke Uni Eropa.', 'en' => 'Compliance for exporting chemicals and polymers to the European Union.'],
            'media_id' => MediaSeeder::id('reach-compliance.pdf'), 'is_published' => true, 'sort_order' => 1,
        ]);
        Certificate::create([
            'name' => ['id' => 'Safety Data Sheet Resiprene 35', 'en' => 'Safety Data Sheet Resiprene 35'],
            'material' => ['id' => 'Lembar Data Keselamatan (SDS/MSDS)', 'en' => 'Safety Data Sheet (SDS/MSDS)'],
            'description' => ['id' => 'Informasi keselamatan, penanganan, dan penyimpanan Resiprene 35.', 'en' => 'Safety, handling, and storage information for Resiprene 35.'],
            'media_id' => MediaSeeder::id('sds-resiprene.pdf'), 'is_published' => true, 'sort_order' => 2,
        ]);
    }

    private function brochures(): void
    {
        if (Brochure::count() > 0) {
            return;
        }

        Brochure::create([
            'title' => ['id' => 'Brosur Produk Resiprene 35 (Spesifikasi & Solubilitas)', 'en' => 'Resiprene 35 Product Brochure (Specifications & Solubility)'],
            'media_id' => MediaSeeder::id('brosur-resiprene-35.pdf'), 'is_published' => true, 'sort_order' => 0,
        ]);
        Brochure::create([
            'title' => ['id' => 'Katalog Barang Karet & Komponen Industri', 'en' => 'Rubber Articles & Industrial Components Catalogue'],
            'media_id' => MediaSeeder::id('katalog-barang-karet.pdf'), 'is_published' => true, 'sort_order' => 1,
        ]);
    }

    private function logos(): void
    {
        foreach (['PT Perkebunan Nusantara', 'PT Maritim Warna', 'Coating Solutions Co.'] as $i => $name) {
            CustomerLogo::firstOrCreate(['name' => $name], ['is_active' => true, 'sort_order' => $i]);
        }
    }

    private function docLinks(): void
    {
        if (DocLink::count() > 0) {
            return;
        }

        DocLink::create([
            'category' => 'keberlanjutan',
            'label' => ['id' => 'Whistle Blowing System', 'en' => 'Whistle Blowing System'],
            'description' => ['id' => 'Kanal pelaporan resmi PT IKN', 'en' => 'Official PT IKN reporting channel'],
            'media_id' => MediaSeeder::id('sop-wbs.pdf'), 'is_active' => true, 'sort_order' => 0,
        ]);
        DocLink::create([
            'category' => 'keberlanjutan',
            'label' => ['id' => 'REACH Compliance Certificate', 'en' => 'REACH Compliance Certificate'],
            'description' => ['id' => 'Sertifikat kepatuhan pasar Eropa', 'en' => 'European market compliance certificate'],
            'media_id' => MediaSeeder::id('reach-compliance.pdf'), 'is_active' => true, 'sort_order' => 1,
        ]);
        DocLink::create([
            'category' => DocLink::CATEGORY_WBS,
            'label' => ['id' => 'Dokumen Whistle Blowing System', 'en' => 'Whistle Blowing System Document'],
            'description' => ['id' => 'SOP pelaporan pelanggaran', 'en' => 'Misconduct reporting SOP'],
            'media_id' => MediaSeeder::id('sop-wbs.pdf'), 'is_active' => true, 'sort_order' => 0,
        ]);
    }
}
