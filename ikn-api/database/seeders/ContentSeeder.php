<?php

namespace Database\Seeders;

use App\Models\Brochure;
use App\Models\Certificate;
use App\Models\CustomerLogo;
use App\Models\DocLink;
use App\Models\GalleryItem;
use App\Models\Post;
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
        $tail = [
            'id' => '<p>PT Industri Karet Nusantara terus berkomitmen menghadirkan produk hilir berkualitas tinggi untuk memenuhi kebutuhan pasar nasional maupun internasional.</p>',
            'en' => '<p>PT Industri Karet Nusantara is dedicated to providing high quality downstream rubber products for domestic and global markets.</p>',
        ];

        $posts = [
            [
                'slug' => 'resiprene-pasar-ekspor', 'tag' => 'Produk', 'published_at' => '2026-06-18', 'cover' => 'produksi-karet-1.webp',
                'body' => [
                    'id' => '<h2>Kapasitas produksi ditingkatkan</h2><p>Lini produksi Resiprene 35 di Tanjung Morawa kini beroperasi tiga shift. Investasi difokuskan pada:</p>'
                        .'<ul><li>reaktor siklisasi baru berkapasitas 2 ton per batch,</li><li>sistem kontrol suhu otomatis,</li><li>laboratorium uji mutu bersertifikat.</li></ul>'
                        .'<blockquote><p>"Kami ingin Resiprene menjadi rujukan karet siklis di Asia Tenggara," ujar Direktur Utama PT IKN.</p></blockquote>'
                        .'<h3>Pasar tujuan</h3><p>Pengiriman perdana ditujukan ke produsen cat marine di Singapura dan Vietnam, disusul Korea Selatan pada kuartal berikutnya.</p>',
                    'en' => '<h2>Production capacity expanded</h2><p>The Resiprene 35 line in Tanjung Morawa now runs three shifts. Investment focuses on:</p>'
                        .'<ul><li>a new 2-ton-per-batch cyclisation reactor,</li><li>automatic temperature control,</li><li>a certified quality laboratory.</li></ul>'
                        .'<blockquote><p>"We want Resiprene to be the reference cyclised rubber in Southeast Asia," said the President Director of PT IKN.</p></blockquote>'
                        .'<h3>Target markets</h3><p>First shipments go to marine paint makers in Singapore and Vietnam, followed by South Korea next quarter.</p>',
                ],
                'title' => ['id' => 'Resiprene 35 menembus pasar cat marine ekspor', 'en' => 'Resiprene 35 enters the export marine paint market'],
                'excerpt' => [
                    'id' => 'Permintaan karet siklis untuk cat pelindung kapal terus tumbuh. IKN memperkuat kapasitas produksi Resiprene 35 untuk memenuhi order ekspor.',
                    'en' => 'Demand for cyclised rubber in protective marine coatings keeps growing. IKN is expanding Resiprene 35 capacity to serve export orders.',
                ],
            ],
            [
                'slug' => 'nilai-akhlak-sdm', 'tag' => 'Perusahaan', 'published_at' => '2026-05-02', 'cover' => 'pabrik-2-1.png',
                'title' => ['id' => 'Penguatan budaya AKHLAK di lingkungan kerja', 'en' => 'Strengthening the AKHLAK culture at work'],
                'excerpt' => [
                    'id' => 'Program pengembangan SDM berlandaskan nilai Amanah, Kompeten, Harmonis, Loyal, Adaptif, dan Kolaboratif digelar sepanjang tahun.',
                    'en' => 'A year-round people development program built on the values of Trust, Competence, Harmony, Loyalty, Adaptability, and Collaboration.',
                ],
            ],
            [
                'slug' => 'kemitraan-hilir-karet', 'tag' => 'Kemitraan', 'published_at' => '2026-03-14', 'cover' => 'karet-1-1-scaled.jpg',
                'title' => ['id' => 'IKN perkuat kemitraan hilir karet Sumatera Utara', 'en' => 'IKN strengthens downstream rubber partnerships in North Sumatra'],
                'excerpt' => [
                    'id' => 'Sebagai anak perusahaan PTPN III, IKN membangun kolaborasi rantai pasok karet alam yang saling menguntungkan dengan mitra lokal.',
                    'en' => 'As a PTPN III subsidiary, IKN builds mutually beneficial natural rubber supply chain collaborations with local partners.',
                ],
            ],
        ];

        foreach ($posts as $post) {
            Post::firstOrCreate(['slug' => $post['slug']], [
                'title' => $post['title'],
                'excerpt' => $post['excerpt'],
                'body' => [
                    'id' => '<p>'.$post['excerpt']['id'].'</p>'.($post['body']['id'] ?? '').$tail['id'],
                    'en' => '<p>'.$post['excerpt']['en'].'</p>'.($post['body']['en'] ?? '').$tail['en'],
                ],
                'tag' => $post['tag'],
                'author' => 'Humas PT IKN',
                'cover_media_id' => MediaSeeder::id($post['cover']),
                'is_published' => true,
                'published_at' => $post['published_at'].' 09:00:00',
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
            ['FGJQW6l2hrk', 'Company Profile — PT Industri Karet Nusantara', 'Company Profile — PT Industri Karet Nusantara'],
            ['-CSAwkNrNzY', 'Proses Pengolahan & Mutu Produk Hilir', 'Processing & Quality of Downstream Products'],
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
