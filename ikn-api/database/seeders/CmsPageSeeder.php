<?php

namespace Database\Seeders;

use App\Models\DocLink;
use App\Models\Page;
use Illuminate\Database\Seeder;

/**
 * Halaman company profile dari ikn-fe/lib/site.ts + lib/i18n.ts (KEPUTUSAN: seed awal CMS).
 * Section dibuat hanya bila belum ada (firstOrCreate) agar suntingan admin tidak tertimpa.
 */
class CmsPageSeeder extends Seeder
{
    private static function t(string $id, string $en): array
    {
        return ['id' => $id, 'en' => $en];
    }

    /**
     * Judul & deskripsi SEO halaman bawaan (kata kunci yang dicari pembeli: pabrik karet, barang karet industri,
     * Resiprene 35, Medan). Judul ±50–60 karakter, deskripsi ±140–160 karakter. Juga dipakai migrasi
     * 2026_10_02_000020_improve_default_page_seo untuk DB yang sudah terisi.
     *
     * @return array<string, array{title: array, description: array}>
     */
    public static function seoDefaults(): array
    {
        $t = fn (string $id, string $en) => self::t($id, $en);

        return [
            'home' => [
                'title' => $t('Resiprene 35 & Barang Karet Industri Sejak 1965 | PT IKN', 'Resiprene 35 & Rubber Articles Since 1965 | PT IKN'),
                'description' => $t('Anak usaha PTPN III di Medan yang memproduksi Resiprene 35 (karet siklis) dan barang karet untuk pabrik sawit, perkebunan, dan industri. Berdiri sejak 1965.', 'PTPN III subsidiary in Medan making Resiprene 35 cyclised natural rubber and rubber articles for palm oil mills, plantations and industry. Founded in 1965.'),
            ],
            'tentang' => [
                'title' => $t('Tentang PT IKN: Sejarah Sejak 1965, Visi Misi & Struktur', 'About PT IKN: History Since 1965, Vision & Structure'),
                'description' => $t('Profil PT Industri Karet Nusantara, anak usaha PTPN III di Medan: sejarah pabrik karet sejak 1965, visi dan misi, nilai AKHLAK, serta struktur organisasi.', 'Profile of PT Industri Karet Nusantara, a PTPN III subsidiary in Medan: rubber plant history since 1965, vision and mission, AKHLAK values and organisation.'),
            ],
            'bisnis' => [
                'title' => $t('Resiprene 35 & Barang Karet Industri | PT IKN', 'Resiprene 35 & Industrial Rubber Goods | PT IKN'),
                'description' => $t('Resiprene 35 (karet siklis) untuk cat, tinta, dan coating, serta barang karet untuk perkebunan dan pabrik kelapa sawit. Spesifikasi, cara pesan, dan tanya jawab.', 'Resiprene 35 (cyclised rubber) for paints, inks and coatings, plus rubber goods for plantations and palm oil mills. Specifications, how to order and FAQ.'),
            ],
            'kualitas' => [
                'title' => $t('Kualitas & Inovasi: Uji Mutu dan Sertifikat | PT IKN', 'Quality & Innovation: Testing and Certificates | PT IKN'),
                'description' => $t('Cara PT Industri Karet Nusantara menjaga mutu Resiprene 35 dan barang karet: spesifikasi tertulis, parameter uji laboratorium, standar produk, dan sertifikat.', 'How PT Industri Karet Nusantara controls the quality of Resiprene 35 and rubber articles: written specifications, lab test parameters and certificates.'),
            ],
            'keberlanjutan' => [
                'title' => $t('Keberlanjutan, K3 & Tata Kelola | PT IKN', 'Sustainability, Safety & Governance | PT IKN'),
                'description' => $t('Tanggung jawab lingkungan, keselamatan kerja, tata kelola perusahaan, inisiatif ESG, REACH, dan Whistle Blowing System PT Industri Karet Nusantara.', 'Environmental responsibility, workplace safety, corporate governance, ESG initiatives, REACH and the Whistle Blowing System at PT Industri Karet Nusantara.'),
            ],
            'media' => [
                'title' => $t('Berita, Kegiatan, Galeri & Video | PT IKN', 'News, Activities, Gallery & Video | PT IKN'),
                'description' => $t('Berita terbaru, kegiatan pabrik, galeri foto, dan video profil PT Industri Karet Nusantara, produsen Resiprene 35 dan barang karet industri di Medan.', 'Latest news, plant activities, photo gallery and company profile video of PT Industri Karet Nusantara, maker of Resiprene 35 and rubber articles in Medan.'),
            ],
            'kemitraan' => [
                'title' => $t('Kemitraan, Pelanggan & Permintaan Kerja Sama | PT IKN', 'Partnership, Customers & Business Inquiries | PT IKN'),
                'description' => $t('Pelanggan PT Industri Karet Nusantara di perkebunan, pabrik kelapa sawit, dan industri coating, serta cara mengajukan kerja sama atau permintaan produk.', 'Customers of PT Industri Karet Nusantara in plantations, palm oil mills and the coating industry, and how to send a business or product inquiry.'),
            ],
            'berita' => [
                'title' => $t('Berita & Artikel Industri Karet | PT IKN', 'Rubber Industry News & Articles | PT IKN'),
                'description' => $t('Kabar perusahaan dan artikel tentang Resiprene 35, barang karet industri, serta cara memesan produk dari PT Industri Karet Nusantara di Medan.', 'Company news and articles on Resiprene 35, industrial rubber goods and how to order products from PT Industri Karet Nusantara in Medan.'),
            ],
            'galeri' => [
                'title' => $t('Galeri Foto & Video Pabrik Karet | PT IKN', 'Rubber Plant Photo & Video Gallery | PT IKN'),
                'description' => $t('Foto dan video pabrik barang karet di Tanjung Morawa, pabrik Resiprene di Sei Bamban, dan kegiatan PT Industri Karet Nusantara.', 'Photos and videos of the rubber goods plant in Tanjung Morawa, the Resiprene plant in Sei Bamban and PT Industri Karet Nusantara activities.'),
            ],
            'kontak' => [
                'title' => $t('Hubungi Kami: Kantor Pusat & Lokasi Pabrik | PT IKN', 'Contact Us: Head Office & Factory Locations | PT IKN'),
                'description' => $t('Alamat kantor pusat dan dua pabrik PT Industri Karet Nusantara di Sumatera Utara, telepon, email, WhatsApp marketing, peta lokasi, dan formulir pesan.', 'Head office and plant addresses of PT Industri Karet Nusantara in North Sumatra, with phone, email, sales WhatsApp, location map and a message form.'),
            ],
        ];
    }

    public function run()
    {
        $seo = self::seoDefaults();
        foreach ($this->pages() as $slug => $page) {
            $model = Page::firstOrCreate(['slug' => $slug], [
                'title' => $page['title'],
                'status' => Page::STATUS_PUBLISHED,
                'seo' => $seo[$slug] ?? ['title' => $page['title'], 'description' => $page['description'] ?? ['id' => '', 'en' => '']],
                'template' => 'default',
            ]);

            foreach ($page['sections'] as $index => $section) {
                $model->sections()->firstOrCreate(['key' => $section['key']], [
                    'type' => $section['type'],
                    'sort_order' => $index,
                    'content' => $section['content'],
                    'is_visible' => true,
                ]);
            }
        }
    }

    private function pages(): array
    {
        $t = fn (string $id, string $en) => self::t($id, $en);
        $reach = DocLink::with('media')->where('category', 'keberlanjutan')->where('label->id', 'REACH Compliance Certificate')->first();
        $reachUrl = $reach?->targetUrl() ?: '/keberlanjutan#sertifikat';

        // Susunan konten dari brief pemilik (doc/prompt/prompt.txt, 2026-11-04): Home, About Us, Our Business,
        // Quality & Innovation, Sustainability, News & Media, Partnership, Contact Us. Navbar tetap 6 menu;
        // /kualitas dan /kemitraan ditautkan dari footer dan halaman terkait.
        return [
            'home' => [
                'title' => $t('Beranda', 'Home'),
                'description' => $t('PT Industri Karet Nusantara, produsen Resiprene 35 dan barang karet industri sejak 1965.', 'PT Industri Karet Nusantara, maker of Resiprene 35 and industrial rubber goods since 1965.'),
                'sections' => self::homeSections($t),
            ],

            'tentang' => [
                'title' => $t('Tentang Kami', 'About Us'),
                'description' => $t('Profil PT Industri Karet Nusantara: sejarah sejak 1965, visi, misi, pimpinan, dan struktur perusahaan.', 'Profile of PT Industri Karet Nusantara: history since 1965, vision, mission, leadership and corporate structure.'),
                'sections' => self::aboutSections($t),
            ],

            'bisnis' => [
                'title' => $t('Bisnis Kami', 'Our Business'),
                'description' => $t('Lini bisnis PT Industri Karet Nusantara: Resiprene 35 dan barang karet industri, fasilitas manufaktur, dan kemampuan produksi.', 'PT Industri Karet Nusantara business lines: Resiprene 35 and industrial rubber articles, manufacturing facilities and production capabilities.'),
                'sections' => self::businessSections($t),
            ],

            'kualitas' => [
                'title' => $t('Kualitas & Inovasi', 'Quality & Innovation'),
                'description' => $t('Jaminan mutu, pengembangan produk, pengujian laboratorium, dan sertifikat PT Industri Karet Nusantara.', 'Quality assurance, product development, laboratory testing and certificates at PT Industri Karet Nusantara.'),
                'sections' => self::qualitySections($t),
            ],

            'keberlanjutan' => [
                'title' => $t('Keberlanjutan', 'Sustainability'),
                'description' => $t('Keberlanjutan PT Industri Karet Nusantara: lingkungan, K3, tata kelola, dan inisiatif ESG.', 'Sustainability at PT Industri Karet Nusantara: environment, health and safety, governance and ESG initiatives.'),
                'sections' => self::sustainabilitySections($t, $reachUrl),
            ],

            'media' => [
                'title' => $t('Berita & Media', 'News & Media'),
                'description' => $t('Berita, kegiatan, foto, dan video PT Industri Karet Nusantara.', 'News, activities, photos and videos of PT Industri Karet Nusantara.'),
                'sections' => self::mediaSections($t),
            ],

            'berita' => [
                'title' => $t('Berita', 'News'),
                'description' => $t('Kabar terbaru dari PT Industri Karet Nusantara tentang kegiatan, produk, dan perusahaan.', 'Latest news from PT Industri Karet Nusantara on activities, products and the company.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => [
                        'label' => $t('/ Berita & Media: Berita', '/ News & Media: News'),
                        'title' => $t('Berita & kabar terbaru.', 'Latest news & updates.'),
                        'lead' => $t('Kabar perusahaan, produk, kegiatan, dan kemitraan PT Industri Karet Nusantara. Pilih kategori untuk menyaring berita.', 'Company, product, activity and partnership news from PT Industri Karet Nusantara. Choose a category to filter the list.'),
                        'media' => self::headerMedia(['gedung-rubber-industry.jpg']),
                        'interval' => 6,
                        'layout' => 'cover',
                        'breadcrumb' => false,
                    ]],
                    ['key' => 'list', 'type' => 'news', 'content' => ['empty_text' => $t('Belum ada berita yang dipublikasikan.', 'No news published yet.')]],
                ],
            ],

            'galeri' => [
                'title' => $t('Galeri', 'Gallery'),
                'description' => $t('Galeri foto dan video pabrik, perkebunan, dan kegiatan PT Industri Karet Nusantara.', 'Photo and video gallery of PT Industri Karet Nusantara plants, plantations and activities.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => [
                        'label' => $t('/ Berita & Media: Galeri', '/ News & Media: Gallery'),
                        'title' => $t('Galeri foto & video.', 'Photo & video gallery.'),
                        'lead' => $t('Pabrik, fasilitas produksi, perkebunan karet, dan kegiatan kerja di PT Industri Karet Nusantara.', 'Plants, production facilities, rubber plantations and day-to-day work at PT Industri Karet Nusantara.'),
                        'media' => self::headerMedia(['pabrik-udara-1.jpg', 'kebun-karet-2.jpg']),
                        'interval' => 6,
                        'layout' => 'cover',
                        'breadcrumb' => false,
                    ]],
                    ['key' => 'gallery', 'type' => 'gallery', 'content' => ['photos_label' => $t('/ Foto', '/ Photos'), 'videos_label' => $t('/ Video', '/ Videos'), 'empty_text' => $t('Belum ada media yang dipublikasikan.', 'No media published yet.')]],
                ],
            ],

            'kemitraan' => [
                'title' => $t('Kemitraan', 'Partnership'),
                'description' => $t('Pelanggan PT Industri Karet Nusantara serta cara mengajukan kerja sama dan permintaan produk.', 'Customers of PT Industri Karet Nusantara and how to send a business or product inquiry.'),
                'sections' => self::partnershipSections($t),
            ],

            'kontak' => [
                'title' => $t('Hubungi Kami', 'Contact Us'),
                'description' => $t('Kantor pusat, lokasi pabrik, dan informasi kontak PT Industri Karet Nusantara.', 'Head office, factory locations and contact information of PT Industri Karet Nusantara.'),
                'sections' => self::contactSections($t),
            ],
        ];
    }

    /** Section halaman Tentang (/tentang). Anchor menu: #sejarah (timeline), #visi-misi, #nilai, #struktur-organisasi. */
    public static function aboutSections(callable $t): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Tentang Kami', '/ About Us'),
                'title' => $t('Produsen karet hilir dengan akar sejak 1965.', 'A downstream rubber producer with roots in 1965.'),
                'lead' => $t(
                    'PT Industri Karet Nusantara (IKN) adalah anak perusahaan PT Perkebunan Nusantara III (Persero) yang mengolah karet alam menjadi Resiprene 35 dan barang karet industri di dua pabrik di Sumatera Utara.',
                    'PT Industri Karet Nusantara (IKN) is a subsidiary of PT Perkebunan Nusantara III (Persero) that turns natural rubber into Resiprene 35 and industrial rubber articles at two plants in North Sumatra.'
                ),
                'media' => self::headerMedia(['gedung-kantor-udara.jpg', 'pabrik-udara-2.jpg']),
                'interval' => 6,
                'layout' => 'cover',
                'breadcrumb' => false,
            ]],
            ['key' => 'profile', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Profil perusahaan', '/ Company overview'),
                'heading' => $t('Dari pabrik ban sepeda ke produsen karet hilir.', 'From a bicycle tyre factory to a downstream rubber producer.'),
                'body' => $t(
                    "Sejarah IKN dimulai pada 1965 dengan Pabrik Ban Sepeda TAVIP di Sumatera Utara yang dikelola DATAK. Selama empat dekade berikutnya pabrik ini dikelola beberapa perusahaan perkebunan, dan produknya berkembang dari ban sepeda menjadi karet gelang, compound, conveyor belt, dock fender, dan barang karet lain. Pada 4 April 2006 pabrik ini menjadi PT Industri Karet Nusantara berdasarkan Akta Pendirian No. 4 Tahun 2006.\n\nKini IKN memiliki dua lini bisnis. Resiprene 35, resin karet alam tersiklisasi untuk cat, tinta, dan coating, diproduksi di pabrik Sei Bamban, Serdang Bedagai. Barang karet untuk pabrik kelapa sawit, perkebunan, dan industri umum diproduksi di pabrik Tanjung Morawa, Medan, yang juga menjadi kantor pusat.",
                    "IKN traces its history to 1965, when the TAVIP Bicycle Tyre Factory opened in North Sumatra under DATAK. Over the next four decades the plant was run by several plantation companies, and its range grew from bicycle tyres to rubber bands, compound, conveyor belts, dock fenders and other rubber articles. On 4 April 2006 it became PT Industri Karet Nusantara by Deed of Establishment No. 4 of 2006.\n\nToday IKN has two business lines. Resiprene 35, a cyclised natural rubber resin for paints, inks and coatings, is made at the Sei Bamban plant in Serdang Bedagai. Rubber articles for palm oil mills, plantations and general industry are made at the Tanjung Morawa plant in Medan, which is also the head office."
                ),
                'button_label' => $t('Lihat bisnis kami', 'See our business'),
                'button_url' => '/bisnis',
                'image' => MediaSeeder::id('gedung-rubber-industry.jpg'),
                'image_alt' => $t('Gedung PT Industri Karet Nusantara di Tanjung Morawa', 'PT Industri Karet Nusantara building at Tanjung Morawa'),
                'image_side' => 'right',
                'visual_label' => '/ Tanjung Morawa',
                'visual_mark' => '',
            ]],
            ['key' => 'history', 'type' => 'timeline', 'content' => [
                'label' => $t('/ Sejarah & tonggak', '/ History & milestones'),
                'heading' => $t('Dari TAVIP pada 1965 hingga PT IKN pada 2006.', 'From TAVIP in 1965 to PT IKN in 2006.'),
                'start' => 'oldest',
                'items' => self::historyItems($t),
            ]],
            ['key' => 'vision-mission', 'type' => 'vision_mission', 'content' => [
                'label' => $t('Cara kami mencapainya', 'How we get there'),
                'heading' => $t('Visi & misi.', 'Vision & mission.'),
                'vision_tag' => $t('Visi', 'Vision'),
                'vision' => $t('Menjadi perusahaan hilir karet terdepan yang memenuhi kebutuhan pelanggan melalui tata kelola yang kuat dan daya saing global.', 'To be the leading downstream rubber company that meets customer needs through strong governance and global competitiveness.'),
                'vision_highlight' => $t('perusahaan hilir karet terdepan', 'leading downstream rubber company'),
                'mission_lead' => $t('Lima komitmen yang memandu setiap keputusan di IKN.', 'Five commitments that guide every decision at IKN.'),
                'mission_tag' => $t('Misi', 'Mission'),
                'missions' => [
                    ['text' => $t('Memproduksi produk hilir karet bermutu sesuai standar dan harapan pelanggan.', 'Produce downstream rubber products to agreed standards and customer expectations.')],
                    ['text' => $t('Membangun lingkungan kerja terukur dan berorientasi tujuan dengan tata kelola yang baik.', 'Build a measurable, goal-oriented workplace with good governance.')],
                    ['text' => $t('Mengembangkan sumber daya manusia berlandaskan nilai AKHLAK.', 'Develop our people on the AKHLAK values.')],
                    ['text' => $t('Membangun kemitraan yang saling menguntungkan dengan seluruh pemangku kepentingan.', 'Build mutually beneficial partnerships with all stakeholders.')],
                    ['text' => $t('Memanfaatkan dan mengembangkan teknologi dalam proses bisnis.', 'Use and develop technology in our business processes.')],
                ],
            ]],
            ['key' => 'values', 'type' => 'values', 'content' => [
                'label' => $t('Nilai inti', 'Core values'),
                'heading' => $t('Tata Nilai', 'Our Values'),
                'lead' => $t('Tata nilai AKHLAK menjadi pedoman perilaku insan IKN dalam melayani pelanggan, membangun kolaborasi, menjaga kepercayaan, dan merespons perubahan.', 'The AKHLAK values guide how IKN people serve customers, build collaboration, keep trust and respond to change.'),
                'items' => [
                    ['title' => $t('Amanah', 'Amanah (Trust)'), 'body' => $t('Memegang teguh kepercayaan yang diberikan.', 'Holding firmly to the trust given.')],
                    ['title' => $t('Kompeten', 'Kompeten (Competence)'), 'body' => $t('Terus belajar dan mengembangkan kapabilitas.', 'Continuously learning and developing capabilities.')],
                    ['title' => $t('Harmonis', 'Harmonis (Harmony)'), 'body' => $t('Saling peduli dan menghargai perbedaan.', 'Caring for one another and respecting differences.')],
                    ['title' => $t('Loyal', 'Loyal (Loyalty)'), 'body' => $t('Berdedikasi dan mengutamakan kepentingan bersama.', 'Dedicated and putting shared interests first.')],
                    ['title' => $t('Adaptif', 'Adaptif (Adaptability)'), 'body' => $t('Terus berinovasi menghadapi perubahan.', 'Continuously innovating in the face of change.')],
                    ['title' => $t('Kolaboratif', 'Kolaboratif (Collaboration)'), 'body' => $t('Membangun kerja sama yang sinergis.', 'Building synergistic cooperation.')],
                ],
            ]],
            // Susunan pengurus dari COMPANY PROFILE PT IKN.pptx (posisi Februari 2024). Detail perorangan (pendidikan,
            // karir, dasar pengangkatan, kutipan) hanya diisi data terverifikasi; sisanya dilengkapi admin.
            ['key' => 'komisaris', 'type' => 'team', 'content' => [
                'label' => $t('/ Organisasi & kepemimpinan', '/ Organisation & leadership'),
                'heading' => $t('Dewan Komisaris', 'Board of Commissioners'),
                'lead' => $t('Susunan per Februari 2024, sesuai profil perusahaan. Klik kartu untuk melihat detail.', 'As of February 2024, per the company profile. Click a card for details.'),
                'items' => [
                    self::person($t, 'Husairi', 'Komisaris Utama', 'President Commissioner'),
                    self::person($t, 'Marahalim Harahap', 'Komisaris Independen', 'Independent Commissioner'),
                ],
            ]],
            ['key' => 'manajemen', 'type' => 'team', 'content' => [
                'label' => $t('', ''),
                'heading' => $t('Manajemen', 'Management'),
                'lead' => $t('', ''),
                'items' => [
                    self::person($t, 'Drs. J. Swondo', 'Direktur', 'Director'),
                    self::person($t, 'Amalia Nasution', 'SEVP Operasional', 'SEVP Operations'),
                ],
            ]],
            self::orgChartSection($t),
            ['key' => 'struktur-korporasi', 'type' => 'spec_table', 'content' => [
                'label' => $t('/ Struktur korporasi', '/ Corporate structure'),
                'heading' => $t('Bagian dari Grup PT Perkebunan Nusantara.', 'Part of the PT Perkebunan Nusantara Group.'),
                'lead' => $t(
                    'IKN berbentuk perseroan terbatas. PT Perkebunan Nusantara III (Persero) memegang 99,99% sahamnya, sehingga IKN menjadi bagian dari Grup PT Perkebunan Nusantara.',
                    'IKN is a limited liability company. PT Perkebunan Nusantara III (Persero) holds 99.99% of its shares, which makes IKN a member of the PT Perkebunan Nusantara Group.'
                ),
                'rows' => [
                    ['label' => $t('Nama perusahaan', 'Legal name'), 'value' => $t('PT Industri Karet Nusantara', 'PT Industri Karet Nusantara')],
                    ['label' => $t('Pendirian', 'Incorporation'), 'value' => $t('4 April 2006, Akta Pendirian No. 4 Tahun 2006 (Notaris Syafnil Gani, SH, M.Hum)', '4 April 2006, Deed of Establishment No. 4 of 2006 (Notary Syafnil Gani, SH, M.Hum)')],
                    ['label' => $t('Pemegang saham', 'Shareholders'), 'value' => $t('PT Perkebunan Nusantara III (Persero) 99,99%; Koperasi Karyawan Nusa Tiga 0,01%', 'PT Perkebunan Nusantara III (Persero) 99.99%; Koperasi Karyawan Nusa Tiga 0.01%')],
                    ['label' => $t('Grup usaha', 'Group'), 'value' => $t('Grup PT Perkebunan Nusantara', 'PT Perkebunan Nusantara Group')],
                    ['label' => $t('Organ perusahaan', 'Governing bodies'), 'value' => $t('RUPS, Dewan Komisaris, dan Direktur', 'General Meeting of Shareholders, Board of Commissioners and Director')],
                    ['label' => $t('Unit kerja', 'Business units'), 'value' => $t('Kantor pusat & Pabrik Rubber Articles (Tanjung Morawa, Medan); Pabrik Resiprene (Sei Bamban, Serdang Bedagai)', 'Head office & Rubber Articles plant (Tanjung Morawa, Medan); Resiprene plant (Sei Bamban, Serdang Bedagai)')],
                    ['label' => $t('Awal industri', 'Industrial origins'), 'value' => $t('1965, Pabrik Ban Sepeda TAVIP', '1965, TAVIP Bicycle Tyre Factory')],
                ],
                'note' => $t('', ''),
            ]],
            ['key' => 'cta', 'type' => 'cta', 'content' => [
                'label' => $t('/ Bekerja sama dengan IKN', '/ Work with IKN'),
                'title' => $t('Bicarakan kebutuhan karet Anda dengan kami.', 'Talk to us about your rubber requirements.'),
                'body' => $t('Tim marketing kami siap menjelaskan spesifikasi, harga, dan jadwal pengiriman.', 'Our marketing team can walk you through specifications, pricing and delivery schedules.'),
                'button_label' => $t('Hubungi kami', 'Contact us'),
                'button_url' => '/kontak',
                'secondary_label' => $t('Kemitraan', 'Partnership'),
                'secondary_url' => '/kemitraan',
            ]],
        ];
    }

    /**
     * Section beranda (redesign 2026-11-04, susunan dari brief pemilik doc/prompt/prompt.txt). Semua fakta dari sumber klien:
     * COMPANY PROFILE PT IKN.pptx (sejarah, pemegang saham, unit kerja, mesin, aplikasi, pelanggan), brosur Resiprene,
     * sertifikat REACH, dan data katalog. Kapasitas produksi sengaja tidak dicantumkan (sumber klien saling bertentangan).
     */
    public static function homeSections(callable $t): array
    {
        return [
            ['key' => 'hero', 'type' => 'hero', 'content' => [
                'meta' => [
                    ['text' => $t('/ Sejak 1965', '/ Since 1965'), 'color' => ''],
                    ['text' => $t('Anak usaha PT Perkebunan Nusantara III', 'Subsidiary of PT Perkebunan Nusantara III'), 'color' => ''],
                    ['text' => $t('Medan, Sumatera Utara', 'Medan, North Sumatra'), 'color' => ''],
                ],
                'title' => $t("Merekayasa solusi karet\nuntuk hari esok yang lebih baik.", "Engineering Rubber Solutions\nfor a Better Tomorrow."),
                'subtitle' => $t(
                    'Dengan pengalaman puluhan tahun di industri karet, PT Industri Karet Nusantara menghadirkan produk berbasis karet dan solusi industri yang inovatif, sambil terus menerapkan praktik manufaktur yang berkelanjutan.',
                    'With decades of experience in the rubber industry, PT Industri Karet Nusantara delivers innovative rubber-based products and industrial solutions while continuously embracing sustainable manufacturing practices.'
                ),
                'buttons' => [
                    ['label' => $t('Jelajahi Bisnis Kami', 'Explore Our Business'), 'url' => '/bisnis', 'style' => 'solid', 'profile_document' => false, 'new_tab' => false],
                    ['label' => $t('Kenali Perusahaan Kami', 'Discover Our Company'), 'url' => '/tentang', 'style' => 'outline', 'profile_document' => false, 'new_tab' => false],
                ],
                'slides' => self::mediaItems([
                    'hero-perkebunan-drone.jpg' => $t('Foto udara perkebunan karet', 'Aerial view of a rubber plantation'),
                    'pabrik-2-1.png' => $t('Foto udara kompleks pabrik PT IKN', 'Aerial view of a PT IKN plant complex'),
                    'produksi-karet-1.webp' => $t('Pemotongan slab karet di pabrik', 'Cutting rubber slabs at the plant'),
                ], 'image', 'alt'),
                // Tata letak kisi layar penuh (2026-11-04): video drone kebun karet klien, dua angka, kartu sorotan.
                'layout' => 'grid',
                'video' => MediaSeeder::id('hero-perkebunan-drone.mp4'),
                'videos' => array_values(array_filter([['file' => MediaSeeder::id('hero-perkebunan-drone-2.mp4')]], fn ($v) => $v['file'] !== null)),
                'overlay' => 45,
                'stats' => [
                    ['value' => '60+', 'label' => $t('Tahun pengalaman manufaktur karet', 'Years of rubber manufacturing')],
                    ['value' => '02', 'label' => $t('Lini bisnis, dua pabrik', 'Business lines, two plants')],
                ],
                // Ubin "02" berlatar peta satelit kedua pabrik (titik dari blok kontak).
                'tile_map' => true,
                'links' => [
                    ['title' => $t('Resiprene 35', 'Resiprene 35'), 'note' => $t('Cyclised natural rubber · Sei Bamban', 'Cyclised natural rubber · Sei Bamban'), 'image' => MediaSeeder::id('resiprene-35.jpg'), 'url' => '/bisnis#resiprene-35'],
                    ['title' => $t('Rubber Articles', 'Rubber Articles'), 'note' => $t('Barang karet industri · Tanjung Morawa', 'Industrial rubber goods · Tanjung Morawa'), 'image' => MediaSeeder::id('rubber-articles-packing-endless.jpg'), 'url' => '/bisnis#barang-karet'],
                ],
                'card_title' => $t("Resiprene 35 dipakai produsen coating\ndi 13 negara.", "Resiprene 35 serves coating makers\nin 13 countries."),
                'card_note' => $t('Terdaftar REACH untuk Uni Eropa', 'REACH-registered for the EU'),
                'card_image' => MediaSeeder::id('resiprene-35-cutout.png'),
                'video_id' => 'FGJQW6l2hrk',
                // {year} diganti tahun berjalan oleh FE.
                'corner_text' => $t('Copyright © {year} PT Industri Karet Nusantara', 'Copyright © {year} PT Industri Karet Nusantara'),
                'corner_image' => null,
            ]],
            ['key' => 'glance', 'type' => 'stats', 'content' => [
                'label' => $t('/ Sekilas perusahaan', '/ Company at a glance'),
                'heading' => $t('Berakar di Sumatera Utara sejak 1965.', 'Rooted in North Sumatra since 1965.'),
                'items' => [
                    ['value' => '1965', 'unit' => '', 'label' => $t('Tahun berdiri, sebagai Pabrik Ban Sepeda TAVIP', 'Year established, as the TAVIP Bicycle Tyre Factory')],
                    ['value' => '02', 'unit' => '', 'label' => $t('Lini bisnis: Resiprene 35 dan Rubber Articles', 'Business lines: Resiprene 35 and Rubber Articles')],
                    ['value' => 'III', 'unit' => 'PTPN', 'label' => $t('Anak perusahaan PT Perkebunan Nusantara III (Persero)', 'Subsidiary of PT Perkebunan Nusantara III (Persero)')],
                    ['value' => '60+', 'unit' => '', 'label' => $t('Tahun pengalaman manufaktur karet', 'Years of rubber manufacturing experience')],
                ],
            ]],
            ['key' => 'about', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Tentang IKN', '/ About IKN'),
                'heading' => $t('Lebih dari enam dekade pengalaman industri.', 'More Than Six Decades of Industrial Experience.'),
                'body' => $t(
                    "PT Industri Karet Nusantara (IKN) mengolah karet alam menjadi produk industri di Sumatera Utara. Sejarahnya dimulai pada 1965 dengan Pabrik Ban Sepeda TAVIP yang dikelola DATAK Sumatera Utara. Pabrik ini kemudian dikelola PT Perkebunan II, PT Perkebunan III, dan PT Perkebunan Nusantara III, lalu pada 4 April 2006 menjadi PT Industri Karet Nusantara berdasarkan Akta Pendirian No. 4 Tahun 2006.\n\nIKN adalah anak perusahaan PT Perkebunan Nusantara III (Persero) yang memegang 99,99% saham, sedangkan 0,01% dimiliki Koperasi Karyawan Nusa Tiga. Perusahaan berfokus pada dua lini bisnis: Resiprene 35 yang diproduksi di pabrik Sei Bamban, Serdang Bedagai, dan barang karet (rubber articles) yang diproduksi di pabrik Tanjung Morawa, Medan, tempat kantor pusat berada.",
                    "PT Industri Karet Nusantara (IKN) turns natural rubber into industrial products in North Sumatra. Its history began in 1965 with the TAVIP Bicycle Tyre Factory, managed by DATAK North Sumatra. The plant was later run by PT Perkebunan II, PT Perkebunan III and PT Perkebunan Nusantara III, and on 4 April 2006 it became PT Industri Karet Nusantara by Deed of Establishment No. 4 of 2006.\n\nIKN is a subsidiary of PT Perkebunan Nusantara III (Persero), which holds 99.99% of its shares; the remaining 0.01% is held by Koperasi Karyawan Nusa Tiga. The company focuses on two business lines: Resiprene 35, made at the Sei Bamban plant in Serdang Bedagai, and rubber articles, made at the Tanjung Morawa plant in Medan, where the head office is located."
                ),
                'button_label' => $t('Profil & sejarah lengkap', 'Full profile and history'),
                'button_url' => '/tentang',
                'image' => MediaSeeder::id('kantor-direksi.png'),
                'image_alt' => $t('Kantor pusat PT Industri Karet Nusantara di Medan', 'PT Industri Karet Nusantara head office in Medan'),
                'image_side' => 'left',
                'visual_label' => '/ Est. 1965',
                'visual_mark' => '',
            ]],
            ['key' => 'products', 'type' => 'product_highlights', 'content' => [
                'label' => $t('/ Bisnis & produk', '/ Our business & products'),
                'heading' => $t('Dua lini bisnis dari karet alam.', 'Two business lines built on natural rubber.'),
                'link_label' => $t('Lihat bisnis kami', 'View our business'),
                'link_url' => '/bisnis',
                'items' => [
                    [
                        'image' => MediaSeeder::id('resiprene-35.jpg'),
                        'code' => 'RSP-35', 'name' => 'Resiprene 35', 'kind' => 'Cyclised Natural Rubber',
                        'summary' => $t(
                            'Resiprene 35 (Resin Isoprene 35) adalah resin karet alam yang larut dalam pelarut tidak berbau seperti aliphatic hydrocarbon serta campuran sederhana aromatic dan aliphatic. Diproduksi di pabrik Sei Bamban dan memiliki registrasi REACH untuk pasar Uni Eropa.',
                            'Resiprene 35 (Resin Isoprene 35) is a natural rubber resin that dissolves in odourless solvents such as aliphatic hydrocarbons and simple aromatic and aliphatic blends. It is made at the Sei Bamban plant and holds a REACH registration for the European Union market.'
                        ),
                        'applications' => self::textItems($t, [
                            ['Pelapis pelindung (protective coating)', 'Protective coatings'],
                            ['Cat kapal dan antifouling', 'Marine paints and antifouling'],
                            ['Pelapis beton', 'Concrete coatings'],
                            ['Cat dan pernis', 'Paints and varnishes'],
                            ['Tinta cetak', 'Printing inks'],
                            ['Pita perekat', 'Adhesive tape'],
                        ]),
                        'features' => self::textItems($t, [
                            ['Cepat kering', 'Fast drying'],
                            ['Sangat tahan air', 'Highly water resistant'],
                            ['Tahan bahan kimia (alkali dan asam)', 'Resistant to chemicals (alkalis and acids)'],
                            ['Adhesi sangat baik pada berbagai substrat', 'Very good adhesion to a range of substrates'],
                            ['Titik lunak 125–145 °C', 'Softening point 125–145 °C'],
                        ]),
                        'url' => '/bisnis#resiprene-35',
                    ],
                    [
                        'image' => MediaSeeder::id('rubber-articles-packing-endless.jpg'),
                        'code' => 'IKN-PRD', 'name' => 'Rubber Articles', 'kind' => 'Industrial Rubber Goods',
                        'summary' => $t(
                            'Barang karet buatan pabrik Tanjung Morawa untuk pabrik kelapa sawit, perkebunan, dan industri umum, mulai dari packing pintu rebusan, seal, dan O-ring sampai conveyor belt, speed bump, dan alat pelindung diri perkebunan.',
                            'Rubber goods made at the Tanjung Morawa plant for palm oil mills, plantations and general industry, from sterilizer door packing, seals and O-rings to conveyor belts, speed bumps and plantation protective equipment.'
                        ),
                        'applications' => self::textItems($t, [
                            ['Rebusan (sterilizer) pabrik kelapa sawit', 'Palm oil mill sterilizers'],
                            ['Seal, O-ring, dan packing lembaran', 'Seals, O-rings and sheet packing'],
                            ['Sambungan pipa dan poros (flexible joint, kopling)', 'Pipe and shaft connections (flexible joints, couplings)'],
                            ['Conveyor belt', 'Conveyor belts'],
                            ['Speed bump dan dock fender', 'Speed bumps and dock fenders'],
                            ['Alat pelindung diri perkebunan', 'Plantation protective equipment'],
                        ]),
                        'features' => self::textItems($t, [
                            ['Ukuran dapat disesuaikan dengan permintaan', 'Sizes made to customer requirements'],
                            ['Packing pintu rebusan tipe L, T, dan endless', 'Sterilizer door packing in L, T and endless types'],
                            ['Packing lembaran elastis dan anti air', 'Elastic, water-resistant sheet packing'],
                            ['Logo dapat disesuaikan pada sarung egrek dan sepatu boots', 'Custom logo on sickle covers and boots'],
                        ]),
                        'url' => '/bisnis#barang-karet',
                    ],
                ],
            ]],
            ['key' => 'manufaktur', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Keunggulan manufaktur', '/ Manufacturing excellence'),
                'heading' => $t('Mengolah sumber daya alam menjadi solusi industri.', 'Turning Natural Resources into Industrial Solutions.'),
                'body' => $t(
                    "IKN mengoperasikan dua pabrik di Sumatera Utara. Kantor pusat dan pabrik Rubber Articles menempati lahan 14.884 m² di Jl. Medan–Tanjung Morawa Km 9,5, 1 km dari pintu tol Amplas, 33 km dari Pelabuhan Belawan, dan 29 km dari Bandara Internasional Kualanamu. Mesin produksi aktifnya meliputi satu calender, dua mix mill, dua set press hidrolik, lima square press, dua hand press, satu ball cutter, dan satu unit sand blasting.\n\nPabrik Resiprene di Sei Bamban Estate, Serdang Bedagai, menempati lahan 66.538 m². Pabrik ini dibangun pada 1996, mulai berproduksi pada 1998, dan berjarak 36 km dari sumber bahan baku karet di Gunung Para serta 85 km dari Pelabuhan Belawan lewat jalan tol.",
                    "IKN operates two plants in North Sumatra. The head office and Rubber Articles plant occupy 14,884 m² on Jl. Medan–Tanjung Morawa Km 9.5, 1 km from the Amplas toll gate, 33 km from Belawan port and 29 km from Kualanamu International Airport. Its active production equipment includes a calender, two mix mills, two hydraulic press sets, five square presses, two hand presses, a ball cutter and a sand blasting unit.\n\nThe Resiprene plant at Sei Bamban Estate, Serdang Bedagai, covers 66,538 m². It was built in 1996, started production in 1998, and lies 36 km from its natural rubber source at Gunung Para and 85 km from Belawan port by toll road."
                ),
                'button_label' => $t('', ''),
                'button_url' => '',
                'image' => MediaSeeder::id('pabrik-udara-1.jpg'),
                'image_alt' => $t('Foto udara kompleks pabrik PT IKN', 'Aerial view of a PT IKN plant'),
                'image_side' => 'right',
                'visual_label' => '',
                'visual_mark' => '',
            ]],
            ['key' => 'fasilitas', 'type' => 'image_grid', 'content' => [
                'label' => $t('/ Proses produksi', '/ Production at work'),
                'heading' => $t('Dari bahan baku sampai pengiriman.', 'From raw material to shipment.'),
                'lead' => $t('', ''),
                'link_label' => $t('', ''),
                'link_url' => '',
                'items' => self::mediaItems([
                    'produksi-karet-2.jpg' => $t('Pemeriksaan bahan baku karet', 'Checking rubber raw material'),
                    'bahan-baku-gudang.jpg' => $t('Bahan baku karet di rak penyimpanan', 'Rubber raw material on storage racks'),
                    'pengemasan-muat-1.jpg' => $t('Pemuatan produk dalam kemasan karung', 'Loading bagged products'),
                    'pengemasan-muat-2.jpg' => $t('Pemeriksaan muatan sebelum pengiriman', 'Checking the load before shipment'),
                ], 'image', 'caption'),
            ]],
            ['key' => 'kualitas', 'type' => 'pillars', 'content' => [
                'label' => $t('/ Kualitas & sertifikasi', '/ Quality & certifications'),
                'heading' => $t('Kualitas yang dapat Anda percaya.', 'Quality You Can Trust.'),
                'items' => [
                    ['key' => 'jaminan-mutu', 'icon' => 'shieldCheck', 'title' => $t('Jaminan mutu', 'Quality assurance'), 'body' => $t(
                        'Setiap lini produk dipasok sesuai spesifikasi tertulis. Resiprene 35 dilengkapi brosur yang memuat sifat produknya dan safety data sheet tentang penanganan dan penyimpanan.',
                        'Each product line is supplied against written specifications. Resiprene 35 comes with a brochure that lists its properties and a safety data sheet that covers handling and storage.'
                    ), 'points' => []],
                    ['key' => 'kontrol-mutu', 'icon' => 'gear', 'title' => $t('Kontrol mutu', 'Quality control'), 'body' => $t(
                        'Resiprene 35 memiliki rentang spesifikasi yang terukur:',
                        'Resiprene 35 is specified against measurable ranges:'
                    ), 'points' => self::textItems($t, [
                        ['Titik lunak 125–145 °C', 'Softening point 125–145 °C'],
                        ['Viskositas 18–24 detik (DIN 53211)', 'Viscosity 18–24 s (DIN 53211)'],
                        ['Warna 11–13 Lovibond', 'Colour 11–13 Lovibond'],
                        ['Acid value maks. 5 mg KOH/g', 'Acid value max. 5 mg KOH/g'],
                        ['Densitas 0,88–0,98 g/ml', 'Density 0.88–0.98 g/ml'],
                    ])],
                    ['key' => 'laboratorium', 'icon' => 'microscope', 'title' => $t('Laboratorium & pengujian', 'Laboratory & testing'), 'body' => $t(
                        'Sifat produk dicantumkan beserta satuan dan metode ujinya bila ada, sehingga pembeli dapat membandingkannya dengan hasil laboratorium mereka sendiri.',
                        'Properties are stated with their units and, where one applies, the test method, so buyers can compare them with results from their own laboratory.'
                    ), 'points' => []],
                    ['key' => 'komitmen-mutu', 'icon' => 'award', 'title' => $t('Komitmen mutu produk', 'Product quality commitment'), 'body' => $t(
                        'Ukuran dan profil barang karet dapat disesuaikan dengan kebutuhan pelanggan, dan Resiprene 35 memiliki registrasi REACH untuk pasokan ke Uni Eropa.',
                        'Sizes and profiles of rubber articles can be adjusted to customer requirements, and Resiprene 35 holds a REACH registration for supply to the European Union.'
                    ), 'points' => []],
                ],
            ]],
            ['key' => 'sertifikat', 'type' => 'certificates', 'content' => [
                'label' => $t('/ Sertifikat & dokumen', '/ Certificates & documents'),
                'heading' => $t('Dokumen yang dapat Anda periksa.', 'Documents you can review.'),
                'layout' => 'cards',
                'empty_text' => $t('Belum ada sertifikat yang dipublikasikan.', 'No certificates published yet.'),
            ]],
            ['key' => 'keberlanjutan', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Keberlanjutan', '/ Sustainability'),
                'heading' => $t('Tumbuh bertanggung jawab, menciptakan nilai jangka panjang.', 'Growing Responsibly, Creating Lasting Value.'),
                'body' => $t(
                    'Kami meyakini pertumbuhan industri dan tanggung jawab lingkungan harus berjalan beriringan. Melalui praktik manufaktur yang bertanggung jawab, perbaikan berkelanjutan, serta komitmen kepada karyawan dan masyarakat, kami berupaya menciptakan nilai jangka panjang.',
                    'We believe industrial growth and environmental responsibility must go hand in hand. Through responsible manufacturing practices, continuous improvement, and a commitment to our people and communities, we strive to create lasting value.'
                ),
                'button_label' => $t('Pendekatan keberlanjutan kami', 'Our sustainability approach'),
                'button_url' => '/keberlanjutan',
                'image' => MediaSeeder::id('papan-pabrik-resiprene.jpg'),
                'image_alt' => $t('Papan nama Pabrik Resiprene di Sei Bamban', 'Sign of the Resiprene plant at Sei Bamban'),
                'image_side' => 'right',
                'visual_label' => '/ Sei Bamban',
                'visual_mark' => '',
            ]],
            ['key' => 'pilar-keberlanjutan', 'type' => 'pillars', 'content' => [
                'label' => $t('', ''),
                'heading' => $t('', ''),
                'bg_media' => MediaSeeder::id('kebun-karet-2.jpg'), 'bg_opacity' => 14, 'bg_tone' => 'light',
                'items' => [
                    ['key' => 'lingkungan', 'icon' => 'leaf', 'title' => $t('Tanggung jawab lingkungan', 'Environmental responsibility'), 'body' => $t(
                        'Karet alam adalah bahan baku utama kami. Kami berupaya memakainya secara efisien dan mengelola limbah produksi secara terkendali di kedua pabrik.',
                        'Natural rubber is our main raw material. We aim to use it efficiently and to manage production waste in a controlled way at both plants.'
                    ), 'points' => []],
                    ['key' => 'manufaktur-berkelanjutan', 'icon' => 'factory', 'title' => $t('Manufaktur berkelanjutan', 'Sustainable manufacturing'), 'body' => $t(
                        'Pabrik kami dekat dengan bahan bakunya: pabrik Resiprene berjarak 36 km dari sumber karet di Gunung Para. Kami berupaya menjaga efisiensi energi dan bahan pada proses hilir.',
                        'Our plants are close to their raw material: the Resiprene plant is 36 km from its rubber source at Gunung Para. We work to keep energy and material use efficient in downstream processing.'
                    ), 'points' => []],
                    ['key' => 'k3', 'icon' => 'shieldCheck', 'title' => $t('Keselamatan & kesehatan kerja', 'Occupational health & safety'), 'body' => $t(
                        'Kami berupaya mewujudkan tempat kerja yang sehat dan aman. Pabrik Tanjung Morawa juga membuat alat pelindung diri bagi pekerja kebun, seperti sarung egrek, sarung kampak, dan sepatu boots.',
                        'We work toward a healthy and safe workplace. The Tanjung Morawa plant also makes protective equipment for plantation workers, such as sickle covers, axe sheaths and boots.'
                    ), 'points' => []],
                    ['key' => 'masyarakat', 'icon' => 'users', 'title' => $t('Karyawan & masyarakat', 'People & community'), 'body' => $t(
                        'Kami mengembangkan karyawan berlandaskan nilai inti AKHLAK dan bekerja sama dengan perkebunan serta mitra lokal di Sumatera Utara.',
                        'We develop our people on the AKHLAK core values and work with plantations and local partners across North Sumatra.'
                    ), 'points' => []],
                    ['key' => 'tata-kelola', 'icon' => 'compass', 'title' => $t('Tata kelola perusahaan yang baik', 'Good corporate governance'), 'body' => $t(
                        'Sebagai anak perusahaan PT Perkebunan Nusantara III (Persero), kami menerapkan prinsip Good Corporate Governance dan menyediakan Whistle Blowing System untuk melaporkan dugaan pelanggaran.',
                        'As a subsidiary of PT Perkebunan Nusantara III (Persero), we apply Good Corporate Governance principles and provide a Whistle Blowing System for reporting suspected misconduct.'
                    ), 'points' => []],
                ],
            ]],
            // Pengganti blok pelanggan (permintaan pemilik 2026-11-04): kartu lanjutan dari halaman Bisnis.
            self::nextStepsSection($t, 'selanjutnya'),
            ['key' => 'news', 'type' => 'latest_news', 'content' => [
                'label' => $t('/ Berita & kegiatan', '/ News & activities'),
                'heading' => $t('Berita & kabar terbaru.', 'Latest News & Updates.'),
                'count' => 3,
                'link_label' => $t('Semua berita', 'All news'),
                'link_url' => '/berita',
            ]],
            ['key' => 'galeri', 'type' => 'image_grid', 'content' => [
                'label' => $t('/ Galeri media', '/ Media gallery'),
                'heading' => $t('Pabrik, fasilitas, dan kegiatan kami.', 'Our plants, facilities and activities.'),
                'lead' => $t('', ''),
                'link_label' => $t('Buka galeri', 'Open the gallery'),
                'link_url' => '/galeri',
                'items' => self::mediaItems([
                    'gedung-kantor-udara.jpg' => $t('Foto udara gedung PT Industri Karet Nusantara', 'Aerial view of the PT Industri Karet Nusantara building'),
                    'gedung-rubber-industry.jpg' => $t('Gedung PT Industri Karet Nusantara (Rubber Industry)', 'PT Industri Karet Nusantara (Rubber Industry) building'),
                    'produksi-karet-1.webp' => $t('Pemotongan slab karet', 'Cutting rubber slabs'),
                    'pabrik-2-1.png' => $t('Foto udara kompleks pabrik PT IKN', 'Aerial view of a PT IKN plant complex'),
                    'karet-1-1-scaled.jpg' => $t('Getah karet alam', 'Natural rubber latex'),
                    'kantor-direksi.png' => $t('Kantor pusat PT IKN', 'PT IKN head office'),
                ], 'image', 'caption'),
            ]],
            ['key' => 'videos', 'type' => 'video_gallery', 'content' => [
                'label' => $t('/ Video', '/ Video'),
                'heading' => $t('Profil perusahaan dalam video.', 'The company profile on video.'),
                'videos' => [
                    ['youtube_id' => 'FGJQW6l2hrk', 'title' => $t('Company Profile PT Industri Karet Nusantara', 'PT Industri Karet Nusantara company profile'), 'desc' => $t('Fasilitas produksi, sejarah, serta visi dan misi PT IKN.', 'Production facilities, history, and the vision and mission of PT IKN.')],
                ],
            ]],
            ['key' => 'cta', 'type' => 'cta', 'content' => [
                'label' => $t('/ Hubungi kami', '/ Contact us'),
                'title' => $t('Mari membangun solusi industri yang lebih baik bersama.', "Let's Build Better Industrial Solutions Together."),
                'body' => $t(
                    'Temukan bagaimana IKN dapat mendukung kebutuhan industri Anda melalui produk berbasis karet dan kemampuan manufaktur kami.',
                    'Discover how IKN can support your industrial needs through our rubber-based products and manufacturing capabilities.'
                ),
                'button_label' => $t('Hubungi Tim Kami', 'Contact Our Team'),
                'button_url' => '/kontak',
                'secondary_label' => $t('', ''),
                'secondary_url' => '',
            ]],
        ];
    }

    /** Kartu "Selanjutnya": katalog, kualitas, kemitraan (dulu di halaman Bisnis, kini di beranda). */
    public static function nextStepsSection(callable $t, string $key = 'links'): array
    {
        return ['key' => $key, 'type' => 'link_cards', 'content' => [
            'label' => $t('/ Selanjutnya', '/ Next steps'),
            'heading' => $t('Dari spesifikasi sampai pemesanan.', 'From specifications to ordering.'),
            'lead' => $t('', ''),
            'items' => [
                ['icon' => 'bag', 'title' => $t('Katalog & pemesanan online', 'Catalog & online ordering'), 'body' => $t('Lihat harga dan stok, lalu pesan langsung sebagai pelanggan perusahaan.', 'See prices and stock, then order directly as a business customer.'), 'url' => '/catalog', 'link_label' => $t('Buka katalog', 'Open catalog')],
                ['icon' => 'microscope', 'title' => $t('Kualitas & sertifikat', 'Quality & certificates'), 'body' => $t('Parameter uji, standar produk, dan sertifikat yang kami pegang.', 'Test parameters, product standards and the certificates we hold.'), 'url' => '/kualitas', 'link_label' => $t('Lihat kualitas', 'View quality')],
                ['icon' => 'handshake', 'title' => $t('Kemitraan & permintaan', 'Partnership & inquiries'), 'body' => $t('Pelanggan kami dan cara mengajukan kerja sama atau penawaran.', 'Our customers and how to send a business or quotation inquiry.'), 'url' => '/kemitraan', 'link_label' => $t('Ke kemitraan', 'Go to partnership')],
            ],
        ]];
    }

    /** Kartu pimpinan: nama + jabatan; detail lain kosong sampai datanya tersedia (jabatan saat ini = data terverifikasi). */
    /** Daftar pelanggan customer_map dari nama dipisah koma (logo dan titik sendiri kosong = titik negara). */
    private static function customerList(string $names): array
    {
        return array_map(fn ($name) => ['name' => trim($name), 'logo' => null, 'geo' => ['lat' => null, 'lng' => null]], explode(',', $names));
    }

    private static function person(callable $t, string $name, string $positionId, string $positionEn): array
    {
        return [
            'photo' => null,
            'name' => $name,
            'position' => $t($positionId, $positionEn),
            'bio' => $t('', ''),
            'education' => $t('', ''),
            'career' => [['text' => $t($positionId.' PT Industri Karet Nusantara (posisi Februari 2024)', $positionEn.', PT Industri Karet Nusantara (as of February 2024)')]],
            'appointment' => $t('', ''),
            'quote_title' => $t('', ''),
            'quote_body' => $t('', ''),
        ];
    }

    /** Daftar {field media, field teks} dari berkas MediaSeeder (berkas hilang dilewati agar validasi media wajib lolos). */
    public static function mediaItems(array $files, string $mediaField, string $textField): array
    {
        $items = [];
        foreach ($files as $file => $text) {
            if ($id = MediaSeeder::id($file)) {
                $items[] = [$mediaField => $id, $textField => $text];
            }
        }

        return $items;
    }

    /** Daftar butir teks dua bahasa ({text: {id, en}}) dari pasangan [id, en]. */
    private static function textItems(callable $t, array $pairs): array
    {
        return array_map(fn (array $pair) => ['text' => $t($pair[0], $pair[1])], $pairs);
    }

    /**
     * Section halaman Bisnis (/bisnis); dipakai juga oleh migrasi perapian halaman lewat kelas ini. Anchor menu:
     * #resiprene-35, #barang-karet, #produk (blok katalog FE), #cara-pesan, #tanya-jawab, #unduhan.
     * Data teknis dari brosur Resiprene 35 dan COMPANY PROFILE PT IKN.pptx; kapasitas sengaja tidak dicantumkan.
     */
    public static function businessSections(callable $t): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Bisnis Kami', '/ Our Business'),
                'title' => $t('Dua lini bisnis dari karet alam.', 'Two business lines built on natural rubber.'),
                'lead' => $t(
                    'Pabrik Sei Bamban memproduksi Resiprene 35 untuk industri cat, tinta, dan coating. Pabrik Tanjung Morawa membuat barang karet untuk perkebunan, pabrik kelapa sawit, dan industri umum.',
                    'The Sei Bamban plant makes Resiprene 35 for the paint, ink and coating industries. The Tanjung Morawa plant makes rubber articles for plantations, palm oil mills and general industry.'
                ),
                'media' => self::headerMedia(['produksi-karet-1.webp', 'pabrik-udara-1.jpg']),
                'interval' => 6,
                'layout' => 'cover',
                'breadcrumb' => false,
            ]],
            // Panel produk (gaya ptpn4.co.id): anchor menu #resiprene-35 / #barang-karet = key item.
            ['key' => 'lini-bisnis', 'type' => 'product_showcase', 'content' => [
                'label' => $t('', ''),
                'heading' => $t('', ''),
                'lead' => $t('', ''),
                'items' => [
                    [
                        'key' => 'resiprene-35',
                        'image' => MediaSeeder::id('resiprene-35.jpg'),
                        'code' => 'RSP-35',
                        'name' => 'Resiprene 35',
                        'kind' => 'Cyclised Natural Rubber Resin',
                        'summary' => $t(
                            "Resiprene 35 (Resin Isoprene 35) adalah karet alam tersiklisasi yang larut dalam pelarut tidak berbau, terutama aliphatic hydrocarbon dan campuran sederhana aromatic dan aliphatic, untuk coating pelindung dan perawatan serta cat kapal yang diaplikasikan dengan kuas, roller, atau semprot.\n\nCepat kering, sangat tahan air, tahan alkali dan asam, dan melekat baik pada berbagai substrat. Dibuat dari 100% karet alam di pabrik Sei Bamban, terdaftar REACH untuk pasar Uni Eropa, dan dijual per kilogram dengan minimum order 25 kg.",
                            "Resiprene 35 (Resin Isoprene 35) is a cyclised natural rubber that dissolves in odourless solvents, particularly aliphatic hydrocarbons and simple blends of aromatic and aliphatic solvents, for protective and maintenance coatings and marine paints applied by brush, roller or spray.\n\nIt dries fast, is highly water resistant, resists alkalis and acids and adheres well to a range of substrates. It is made from 100% natural rubber at the Sei Bamban plant, holds a REACH registration for the EU market and is sold per kilogram with a 25 kg minimum order."
                        ),
                        'points' => [],
                        'specs' => [
                            ['label' => $t('Aplikasi', 'Applications'), 'value' => $t('Coating pelindung, cat kapal & antifouling, pelapis beton, cat & pernis, tinta cetak, pita perekat', 'Protective coatings, marine paints & antifouling, concrete coatings, paints & varnishes, printing inks, adhesive tape')],
                            ['label' => $t('Nomor CAS', 'CAS No.'), 'value' => $t('68441-13-4', '68441-13-4')],
                            ['label' => $t('Titik lunak (kapiler)', 'Softening point (capillary)'), 'value' => $t('125–145 °C', '125–145 °C')],
                            ['label' => $t('Viskositas (Ford cup 4, DIN 53211)', 'Viscosity (Ford cup 4, DIN 53211)'), 'value' => $t('18–24 detik', '18–24 s')],
                            ['label' => $t('Warna', 'Colour'), 'value' => $t('11–13 Lovibond', '11–13 Lovibond')],
                            ['label' => $t('Acid value', 'Acid value'), 'value' => $t('Maks. 5 mg KOH/g', 'Max. 5 mg KOH/g')],
                            ['label' => $t('Densitas', 'Density'), 'value' => $t('0,88–0,98 g/ml', '0.88–0.98 g/ml')],
                            ['label' => $t('Suhu transisi gelas', 'Glass transition (Tg)'), 'value' => $t('95 °C', '95 °C')],
                            ['label' => $t('Larut sempurna', 'Fully soluble in'), 'value' => $t('White spirit, pelarut petroleum 100–140 °C, aromatic oil, xylene, toluene', 'White spirit, petroleum solvents 100–140 °C, aromatic oils, xylene, toluene')],
                            ['label' => $t('Tidak larut', 'Not soluble in'), 'value' => $t('Methyl ethyl ketone, n-butanol', 'Methyl ethyl ketone, n-butanol')],
                        ],
                        'button_label' => $t('Lihat di katalog', 'View in the catalog'),
                        'button_url' => '/catalog/resiprene-35',
                    ],
                    [
                        'key' => 'barang-karet',
                        'image' => MediaSeeder::id('rubber-articles-packing-endless.jpg'),
                        'code' => 'IKN-PRD',
                        'name' => 'Rubber Articles',
                        'kind' => 'Industrial Rubber Goods',
                        'summary' => $t(
                            "Pabrik Tanjung Morawa membuat komponen teknis untuk pabrik kelapa sawit, seperti packing pintu rebusan, seal, O-ring, dan packing lembaran, serta conveyor belt, speed bump, alas karet, dan alat pelindung diri bagi pekerja kebun.\n\nProduk yang tersedia bisa dipesan lewat katalog online. Membran filter press, kopling karet, flexible joint, dan komponen berukuran khusus dibuat sesuai gambar teknik melalui permintaan penawaran.",
                            "The Tanjung Morawa plant makes technical parts for palm oil mills, such as sterilizer door packing, seals, O-rings and sheet packing, as well as conveyor belts, speed bumps, rubber mats and protective equipment for plantation workers.\n\nItems in stock can be ordered from the online catalog. Filter press membranes, rubber couplings, flexible joints and custom-size parts are made to your engineering drawing through a quote request."
                        ),
                        'points' => self::textItems($t, [
                            ['Packing pintu rebusan tipe L, T, endless', 'Sterilizer door packing: L, T, endless'],
                            ['Seal, O-ring, packing lembaran', 'Seals, O-rings, sheet packing'],
                            ['Conveyor belt 2–5 ply', 'Conveyor belts, 2–5 ply'],
                            ['Speed bump & dock fender', 'Speed bumps & dock fenders'],
                            ['Kopling, flexible & expansion joint', 'Couplings, flexible & expansion joints'],
                            ['Perlengkapan & APD perkebunan', 'Plantation equipment & PPE'],
                        ]),
                        'specs' => [],
                        'button_label' => $t('Lihat barang karet di katalog', 'View rubber articles in the catalog'),
                        'button_url' => '/catalog/kategori/rubber-articles',
                    ],
                ],
            ]],
            ['key' => 'ragam-produk', 'type' => 'icon_features', 'content' => [
                'label' => $t('/ Ragam Rubber Articles', '/ Rubber Articles range'),
                'heading' => $t('Delapan kelompok produk.', 'Eight product groups.'),
                'lead' => $t('Ukuran dalam daftar ini adalah ukuran standar; sebagian besar produk juga dibuat sesuai permintaan.', 'Sizes listed are standard sizes; most products are also made to order.'),
                'columns' => '4',
                'icon_style' => 'soft',
                'align' => 'left',
                'items' => [
                    ['icon' => 'package', 'image' => null, 'title' => $t('Packing pintu rebusan', 'Sterilizer door packing'), 'body' => $t('Tipe L, T, dan endless untuk rebusan pabrik kelapa sawit. Tebal 8–10 mm, lebar 15–20 mm, tinggi 20–37 mm; panjang sesuai kebutuhan.', 'L, T and endless types for palm oil mill sterilizers. Thickness 8–10 mm, width 15–20 mm, height 20–37 mm; length to order.')],
                    ['icon' => 'drop', 'image' => null, 'title' => $t('Seal, O-ring & packing', 'Seals, O-rings & packing'), 'body' => $t('Packing vibro dan packing lembaran elastis serta anti air, tebal 3–12 mm dengan lebar 1.000 mm. Seal dan O-ring berbagai ukuran.', 'Elastic, water-resistant vibro and sheet packing, 3–12 mm thick at 1,000 mm width. Seals and O-rings in a range of sizes.')],
                    ['icon' => 'truck', 'image' => null, 'title' => $t('Conveyor belt', 'Conveyor belts'), 'body' => $t('Motif polos atau sersan, tebal 7–10 mm, lebar 500–1.000 mm, 2–5 ply.', 'Plain or chevron pattern, 7–10 mm thick, 500–1,000 mm wide, 2–5 ply.')],
                    ['icon' => 'shieldCheck', 'image' => null, 'title' => $t('Speed bump & dock fender', 'Speed bumps & dock fenders'), 'body' => $t('Speed bump tebal 25 atau 50 mm, warna kuning dan hitam, serta bumper dermaga muat.', 'Speed bumps 25 or 50 mm thick in yellow and black, and loading dock bumpers.')],
                    ['icon' => 'gear', 'image' => null, 'title' => $t('Kopling & sambungan', 'Couplings & joints'), 'body' => $t('Kopling karet, flexible joint, dan expansion joint dalam berbagai bentuk dan ukuran.', 'Rubber couplings, flexible joints and expansion joints in various shapes and sizes.')],
                    ['icon' => 'users', 'image' => null, 'title' => $t('Perlengkapan perkebunan', 'Plantation equipment'), 'body' => $t('Sarung egrek, sarung dodos dan kampak, pelindung stick alloy, sepatu boots, dan safety boots.', 'Sickle covers, dodos and axe sheaths, alloy stick guards, rubber boots and safety boots.')],
                    ['icon' => 'ruler', 'image' => null, 'title' => $t('Alas karet', 'Rubber mats'), 'body' => $t('Alas kaki, rubber welcome, dan cow mat; ukuran standar 50 × 50 cm atau 1.000 × 1.000 × 10 mm.', 'Floor mats, welcome mats and cow mats; standard sizes 50 × 50 cm or 1,000 × 1,000 × 10 mm.')],
                    ['icon' => 'flask', 'image' => null, 'title' => $t('Compound', 'Compound'), 'body' => $t('Campuran karet alam, karet sintetis, dan bahan kimia tertentu yang digiling merata sebagai bahan baku produk karet lanjutan.', 'Natural and synthetic rubber blended with selected chemicals and milled evenly, as raw material for further rubber products.')],
                ],
            ]],
            ['key' => 'fasilitas', 'type' => 'pillars', 'content' => [
                'label' => $t('/ Fasilitas manufaktur', '/ Manufacturing facilities'),
                'heading' => $t('Dua pabrik di Sumatera Utara.', 'Two plants in North Sumatra.'),
                'items' => [
                    ['key' => 'tanjung-morawa', 'icon' => 'factory', 'title' => $t('Tanjung Morawa, Medan', 'Tanjung Morawa, Medan'), 'body' => $t('Kantor pusat dan pabrik Rubber Articles di Jl. Medan–Tanjung Morawa Km 9,5.', 'Head office and Rubber Articles plant on Jl. Medan–Tanjung Morawa Km 9.5.'), 'points' => self::textItems($t, [
                        ['Luas lahan 14.884 m²', 'Site area 14,884 m²'],
                        ['Listrik, air, dan gudang tersedia', 'Power, water and warehousing on site'],
                        ['Akses jalan tol, pelabuhan, dan bandara; lokasi bebas banjir', 'Access to toll road, port and airport; flood-free location'],
                    ])],
                    ['key' => 'sei-bamban', 'icon' => 'factory', 'title' => $t('Sei Bamban, Serdang Bedagai', 'Sei Bamban, Serdang Bedagai'), 'body' => $t('Pabrik Resiprene di Sei Bamban Estate, dibangun pada 1996 dan berproduksi sejak 1998.', 'Resiprene plant at Sei Bamban Estate, built in 1996 and producing since 1998.'), 'points' => self::textItems($t, [
                        ['Luas lahan 66.538 m²', 'Site area 66,538 m²'],
                        ['36 km (sekitar 46 menit) dari sumber bahan baku karet di Gunung Para', '36 km (about 46 minutes) from its natural rubber source at Gunung Para'],
                        ['Listrik, air, dan gudang tersedia; dekat jalan tol dan bebas banjir', 'Power, water and warehousing on site; close to the toll road and flood-free'],
                    ])],
                ],
            ]],
            ['key' => 'fasilitas-foto', 'type' => 'image_grid', 'content' => [
                'label' => $t('', ''),
                'heading' => $t('', ''),
                'lead' => $t('', ''),
                'link_label' => $t('', ''),
                'link_url' => '',
                'items' => self::mediaItems([
                    'pabrik-udara-1.jpg' => $t('Foto udara kompleks pabrik PT IKN', 'Aerial view of a PT IKN plant'),
                    'pabrik-udara-2.jpg' => $t('Foto udara pabrik PT IKN di tengah perkebunan', 'Aerial view of a PT IKN plant among plantations'),
                    'gedung-rubber-industry.jpg' => $t('Gedung kantor pusat di Tanjung Morawa', 'Head office building at Tanjung Morawa'),
                    'papan-pabrik-resiprene.jpg' => $t('Papan nama Pabrik Resiprene Sei Bamban', 'Sign of the Sei Bamban Resiprene plant'),
                ], 'image', 'caption'),
            ]],
            ['key' => 'kapabilitas', 'type' => 'spec_table', 'content' => [
                'label' => $t('/ Kemampuan produksi', '/ Production capabilities'),
                'heading' => $t('Kapasitas dan mesin di dua pabrik.', 'Capacity and equipment at both plants.'),
                'lead' => $t(
                    'Barang karet dicampur, dikalender, dicetak, dan diselesaikan di Tanjung Morawa; ukuran, profil, dan logo dapat disesuaikan dengan kebutuhan pelanggan. Resiprene 35 diolah dari karet alam di Sei Bamban.',
                    'Rubber articles are mixed, calendered, moulded and finished at Tanjung Morawa; sizes, profiles and logos can be made to customer requirements. Resiprene 35 is processed from natural rubber at Sei Bamban.'
                ),
                'rows' => array_merge(
                    array_map(fn ($r) => ['group' => $t('Tanjung Morawa · Rubber Articles', 'Tanjung Morawa · Rubber Articles')] + $r, [
                        ['label' => $t('Kapasitas produksi', 'Production capacity'), 'value' => $t('50 ton/tahun', '50 tonnes/year')],
                        ['label' => $t('Mesin calender', 'Calender machine'), 'value' => $t('1 unit', '1 unit')],
                        ['label' => $t('Mix mill', 'Mix mill'), 'value' => $t('2 unit', '2 units')],
                        ['label' => $t('Set press pompa hidrolik', 'Hydraulic pump press set'), 'value' => $t('2 unit', '2 units')],
                        ['label' => $t('Square press', 'Square press'), 'value' => $t('5 unit', '5 units')],
                        ['label' => $t('Hand press', 'Hand press'), 'value' => $t('2 unit', '2 units')],
                        ['label' => $t('Ball cutter', 'Ball cutter'), 'value' => $t('1 unit', '1 unit')],
                        ['label' => $t('Sand blasting', 'Sand blasting'), 'value' => $t('1 unit', '1 unit')],
                    ]),
                    array_map(fn ($r) => ['group' => $t('Sei Bamban · Resiprene 35', 'Sei Bamban · Resiprene 35')] + $r, [
                        ['label' => $t('Kapasitas terpasang', 'Installed capacity'), 'value' => $t('800 ton/tahun', '800 tonnes/year')],
                        ['label' => $t('Realisasi produksi', 'Actual output'), 'value' => $t('500 ton/tahun', '500 tonnes/year')],
                        ['label' => $t('Dibangun / mulai produksi', 'Built / in production'), 'value' => $t('1996 / 1998', '1996 / 1998')],
                        ['label' => $t('Bahan baku', 'Raw material'), 'value' => $t('Karet alam dari Gunung Para, 36 km', 'Natural rubber from Gunung Para, 36 km away')],
                        ['label' => $t('Luas lahan', 'Site area'), 'value' => $t('66.538 m²', '66,538 m²')],
                    ])
                ),
                'note' => $t('Sumber: profil perusahaan PT IKN.', 'Source: PT IKN company profile.'),
            ]],
            ['key' => 'cara-pesan', 'type' => 'steps', 'content' => [
                'bg_media' => MediaSeeder::id('pengemasan-muat-2.jpg'), 'bg_opacity' => 22, 'bg_tone' => 'dark',
                'label' => $t('/ Cara memesan', '/ How to order'),
                'heading' => $t('Dari daftar akun sampai barang tiba.', 'From sign-up to delivery.'),
                'lead' => $t('Pemesanan online terbuka untuk pelanggan perusahaan. Untuk kebutuhan khusus, hubungi tim marketing lewat formulir kontak atau WhatsApp.', 'Online ordering is open to business customers. For special requirements, contact our marketing team through the contact form or WhatsApp.'),
                'items' => [
                    ['icon' => 'users', 'title' => $t('Daftar akun perusahaan', 'Register a company account'), 'body' => $t('Isi data perusahaan, NPWP, dan PIC, lalu buka tautan verifikasi yang kami kirim ke email Anda.', 'Enter your company details, tax ID and contact person, then open the verification link we send to your email.')],
                    ['icon' => 'shieldCheck', 'title' => $t('Tunggu persetujuan', 'Wait for approval'), 'body' => $t('Tim kami memeriksa data pendaftaran. Setelah akun disetujui, Anda bisa checkout.', 'Our team checks your registration. Once the account is approved, you can check out.')],
                    ['icon' => 'bag', 'title' => $t('Pilih produk dan pengiriman', 'Choose products and delivery'), 'body' => $t('Masukkan produk ke keranjang sesuai minimum order, pilih alamat, lalu bandingkan layanan pengiriman beserta ongkirnya.', 'Add products to the cart at or above the minimum order, choose an address, then compare delivery services and their shipping cost.')],
                    ['icon' => 'wallet', 'title' => $t('Bayar dan unggah bukti', 'Pay and upload proof'), 'body' => $t('Bayar dengan transfer bank atau QRIS, lalu unggah bukti pembayaran. Invoice terbit setelah pembayaran diverifikasi.', 'Pay by bank transfer or QRIS, then upload the payment proof. The invoice is issued once the payment is verified.')],
                    ['icon' => 'truck', 'title' => $t('Pantau sampai diterima', 'Track until it arrives'), 'body' => $t('Status pesanan dan nomor resi tampil di dashboard. Setelah barang diterima, selesaikan pesanan dan beri ulasan.', 'Order status and the tracking number show in your dashboard. When the goods arrive, complete the order and leave a review.')],
                ],
            ]],
            ['key' => 'unduhan', 'type' => 'brochures', 'content' => [
                'label' => $t('/ Unduhan', '/ Downloads'),
                'heading' => $t('Brosur & dokumen produk.', 'Product brochures & documents.'),
                'empty_text' => $t('Belum ada dokumen yang dipublikasikan.', 'No documents published yet.'),
            ]],
            ['key' => 'tanya-jawab', 'type' => 'faq', 'content' => [
                'label' => $t('/ Tanya jawab', '/ FAQ'),
                'heading' => $t('Pertanyaan yang sering diajukan.', 'Frequently asked questions.'),
                'lead' => $t('Belum menemukan jawabannya? Tanyakan lewat live chat di pojok kanan bawah.', 'Did not find your answer? Ask through the live chat in the bottom-right corner.'),
                'items' => [
                    ['question' => $t('Siapa yang bisa memesan secara online?', 'Who can order online?'), 'answer' => $t('Pelanggan perusahaan yang sudah mendaftar, memverifikasi email, dan disetujui tim kami. Harga tampil setelah login, dan checkout terbuka setelah akun disetujui.', 'Business customers who have registered, verified their email and been approved by our team. Prices show after login, and checkout opens once the account is approved.')],
                    ['question' => $t('Berapa minimum order?', 'What is the minimum order?'), 'answer' => $t('Minimum order berbeda per produk dan tertulis di halaman produk. Contohnya Resiprene 35 minimum 25 kg, rubber ring minimum 10 buah, dan sarung egrek bisa dipesan mulai satu buah.', 'The minimum order differs per product and is shown on each product page. For example, Resiprene 35 starts at 25 kg, rubber rings at 10 pieces, and sickle covers can be ordered from one piece.')],
                    ['question' => $t('Metode pembayaran apa yang tersedia?', 'Which payment methods are available?'), 'answer' => $t('Transfer bank ke rekening perusahaan atau QRIS. Setelah membayar, unggah bukti di halaman pesanan. Tim kami memverifikasinya dan invoice terbit otomatis.', 'Bank transfer to the company account or QRIS. After paying, upload the proof on the order page. Our team verifies it and the invoice is issued automatically.')],
                    ['question' => $t('Bagaimana ongkos kirim dihitung?', 'How is shipping calculated?'), 'answer' => $t('Ongkir dihitung saat checkout dari zona alamat tujuan, jarak dari pabrik, berat, dan volume kiriman. Tandai lokasi alamat di peta agar semua layanan pengiriman bisa ditawarkan.', 'Shipping is calculated at checkout from the destination zone, distance from the plant, weight and volume. Pin your address on the map so every delivery service can be offered.')],
                    ['question' => $t('Bisa pesan ukuran atau spesifikasi khusus?', 'Can I order custom sizes or specifications?'), 'answer' => $t('Bisa. Produk bertanda Penawaran, seperti membran filter press, kopling karet, dan flexible joint, dibuat sesuai gambar teknik. Kirim kebutuhan Anda lewat formulir kontak, live chat, atau WhatsApp untuk mendapat penawaran harga.', 'Yes. Products marked Quote, such as filter press membranes, rubber couplings and flexible joints, are made to your engineering drawing. Send your requirements through the contact form, live chat or WhatsApp to get a quote.')],
                    ['question' => $t('Di mana saya mendapat dokumen teknis Resiprene 35?', 'Where can I get Resiprene 35 technical documents?'), 'answer' => $t('Brosur spesifikasi dan safety data sheet bisa diunduh di bagian Unduhan halaman ini. Sertifikat REACH ada di halaman Kualitas & Inovasi.', 'The specification brochure and safety data sheet can be downloaded in the Downloads section of this page. The REACH certificate is on the Quality & Innovation page.')],
                    ['question' => $t('Apakah faktur pajak dan surat jalan disediakan?', 'Do you provide tax invoices and delivery notes?'), 'answer' => $t('Ya. Tim kami mengunggah faktur pajak, surat jalan, atau dokumen lain ke halaman pesanan, dan Anda mendapat notifikasi saat dokumen tersedia.', 'Yes. Our team uploads the tax invoice, delivery note or other documents to the order page, and you are notified when they are available.')],
                ],
            ]],
            ['key' => 'cta', 'type' => 'cta', 'content' => [
                'label' => $t('/ Butuh spesifikasi teknis?', '/ Need technical specifications?'),
                'title' => $t('Ceritakan aplikasi dan jumlah yang Anda butuhkan.', 'Tell us your application and the quantity you need.'),
                'body' => $t('Tim marketing kami akan menyiapkan penawaran harga dan jadwal pengirimannya.', 'Our marketing team will prepare a quote and a delivery schedule.'),
                'button_label' => $t('Hubungi tim kami', 'Contact our team'),
                'button_url' => '/kontak',
                'secondary_label' => $t('', ''),
                'secondary_url' => '',
            ]],
        ];
    }

    /**
     * Section halaman Kualitas & Inovasi (/kualitas, 2026-11-04). Fakta: brosur Resiprene 35, COMPANY PROFILE PT IKN.pptx
     * (spesifikasi, standar boots, misi), dan bagan organisasi 2023 (Analis Lab di tim pengolahan Pabrik Resiprene).
     */
    public static function qualitySections(callable $t): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Kualitas & Inovasi', '/ Quality & Innovation'),
                'title' => $t('Terspesifikasi, teruji, dan terdokumentasi.', 'Specified, tested and documented.'),
                'lead' => $t(
                    'Setiap lini produk IKN dipasok sesuai spesifikasi tertulis. Halaman ini menjelaskan cara kami menjaga mutu, mengembangkan produk untuk aplikasi tertentu, dan mendokumentasikan kepatuhan.',
                    'Every IKN product line is supplied against a written specification. This page explains how we control quality, develop products for specific applications and document compliance.'
                ),
                'media' => self::headerMedia(['bahan-baku-gudang.jpg', 'pengemasan-muat-2.jpg']),
                'interval' => 6,
                'layout' => 'cover',
                'breadcrumb' => false,
            ]],
            ['key' => 'jaminan-mutu', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Jaminan mutu', '/ Quality assurance'),
                'heading' => $t('Mutu dimulai dari bahan baku.', 'Quality starts with the raw material.'),
                'body' => $t(
                    "IKN mengolah karet alam dari Sumatera Utara. Pabrik Resiprene berjarak 36 km dari sumber bahan bakunya di Gunung Para, dan Resiprene 35 dibuat dari 100% karet alam.\n\nSetiap lini produk punya spesifikasi tertulis: Resiprene 35 terhadap rentang sifat fisik dan kimia yang terukur, barang karet terhadap ukuran, profil, dan jumlah ply yang disepakati. Brosur produk dan safety data sheet Resiprene 35 bisa diunduh, sehingga pembeli dapat memeriksa spesifikasinya sebelum memesan.",
                    "IKN processes natural rubber from North Sumatra. The Resiprene plant sits 36 km from its rubber source at Gunung Para, and Resiprene 35 is made from 100% natural rubber.\n\nEach product line has a written specification: Resiprene 35 against measured physical and chemical ranges, rubber articles against agreed dimensions, profiles and ply counts. Product brochures and the Resiprene 35 safety data sheet are available to download, so buyers can check the specification before they order."
                ),
                'button_label' => $t('Unduh dokumen produk', 'Download product documents'),
                'button_url' => '/bisnis#unduhan',
                'image' => MediaSeeder::id('produksi-karet-2.jpg'),
                'image_alt' => $t('Pemeriksaan bahan baku karet di pabrik', 'Checking rubber raw material at the plant'),
                'image_side' => 'right',
                'visual_label' => '/ QA',
                'visual_mark' => '',
            ]],
            ['key' => 'pengembangan', 'type' => 'pillars', 'content' => [
                'bg_media' => MediaSeeder::id('bahan-baku-gudang.jpg'), 'bg_opacity' => 10, 'bg_tone' => 'light',
                'label' => $t('/ Riset & pengembangan', '/ Research & development'),
                'heading' => $t('Pengembangan yang berangkat dari aplikasi pelanggan.', 'Development driven by customer applications.'),
                'items' => [
                    ['key' => 'gambar-teknik', 'icon' => 'ruler', 'title' => $t('Dibuat sesuai gambar teknik', 'Made to drawing'), 'body' => $t('Membran filter press, kopling karet, flexible joint, dan komponen nonstandar lain dibuat sesuai gambar teknik pelanggan.', 'Filter press membranes, rubber couplings, flexible joints and other non-standard parts are made to the customer’s engineering drawing.'), 'points' => []],
                    ['key' => 'compound', 'icon' => 'flask', 'title' => $t('Formulasi compound', 'Compound formulation'), 'body' => $t('IKN menggiling compound, campuran karet alam, karet sintetis, dan bahan kimia tertentu, untuk produknya sendiri dan sebagai bahan baku produsen karet lain.', 'IKN mills compound, a blend of natural and synthetic rubber with selected chemicals, for its own products and as raw material for other rubber manufacturers.'), 'points' => []],
                    ['key' => 'ragam-produk', 'icon' => 'sparkle', 'title' => $t('Perkembangan produk', 'Product evolution'), 'body' => $t('Sejak 1965 ragam produk berkembang dari ban sepeda dan karet gelang ke conveyor belt, dock fender, perlengkapan perkebunan, dan, sejak 1998, Resiprene 35.', 'Since 1965 the range has moved from bicycle tyres and rubber bands to conveyor belts, dock fenders, plantation equipment and, since 1998, Resiprene 35.'), 'points' => []],
                    ['key' => 'teknologi', 'icon' => 'gear', 'title' => $t('Teknologi dalam operasi', 'Technology in operations'), 'body' => $t('Memanfaatkan dan mengembangkan teknologi dalam proses bisnis adalah salah satu misi perusahaan.', 'Using and developing technology in our business processes is one of the company’s stated missions.'), 'points' => []],
                ],
            ]],
            ['key' => 'laboratorium', 'type' => 'spec_table', 'content' => [
                'label' => $t('/ Laboratorium & pengujian', '/ Laboratory & testing'),
                'heading' => $t('Parameter uji Resiprene 35.', 'Resiprene 35 test parameters.'),
                'lead' => $t(
                    'Tim pengolahan di pabrik Sei Bamban mencakup analis laboratorium. Resiprene 35 dispesifikasikan terhadap parameter di bawah ini, masing-masing dengan satuan dan, bila ada, metode ujinya.',
                    'The processing team at the Sei Bamban plant includes laboratory analysts. Resiprene 35 is specified against the parameters below, each with its unit and, where one applies, its test method.'
                ),
                'rows' => [
                    ['label' => $t('Titik lunak (metode kapiler)', 'Softening point (capillary method)'), 'value' => $t('125–145 °C', '125–145 °C')],
                    ['label' => $t('Viskositas, Ford cup 4 dalam toluene (DIN 53211)', 'Viscosity, Ford cup 4 in toluene (DIN 53211)'), 'value' => $t('18–24 detik', '18–24 s')],
                    ['label' => $t('Warna', 'Colour'), 'value' => $t('11–13 Lovibond', '11–13 Lovibond')],
                    ['label' => $t('Acid value', 'Acid value'), 'value' => $t('Maks. 5 mg KOH/g', 'Max. 5 mg KOH/g')],
                    ['label' => $t('Densitas', 'Density'), 'value' => $t('0,88–0,98 g/ml', '0.88–0.98 g/ml')],
                    ['label' => $t('Suhu transisi gelas (Tg)', 'Glass transition temperature (Tg)'), 'value' => $t('95 °C', '95 °C')],
                ],
                'note' => $t('Nilai tipikal dari brosur produk dan profil perusahaan.', 'Typical values from the product brochure and company profile.'),
            ]],
            ['key' => 'standar-produk', 'type' => 'spec_table', 'content' => [
                'label' => $t('/ Standar produk', '/ Product standards'),
                'heading' => $t('Standar yang tercantum pada produk kami.', 'Standards stated on our products.'),
                'lead' => $t('', ''),
                'rows' => [
                    ['label' => $t('Resiprene 35', 'Resiprene 35'), 'value' => $t('Registrasi REACH untuk pasokan ke Uni Eropa; safety data sheet tersedia', 'REACH registration for supply to the European Union; safety data sheet available')],
                    ['label' => $t('Safety boots', 'Safety boots'), 'value' => $t('CE EN 20345:2011 approved, toe cap 200 joule, tahan minyak, slip, bahan kimia, dan panas, antistatis; TKDN 89,96%', 'CE EN 20345:2011 approved, 200 joule toe cap, oil, slip, chemical and heat resistant, anti-static; TKDN 89.96%')],
                    ['label' => $t('Sepatu boots non-safety', 'Non-safety boots'), 'value' => $t('Karet PVC, tinggi 37–38 cm, ukuran 38–44; TKDN 94,21%', 'PVC rubber, 37–38 cm high, sizes 38–44; TKDN 94.21%')],
                    ['label' => $t('Rubber articles', 'Rubber articles'), 'value' => $t('Ukuran, profil, dan logo sesuai kebutuhan pelanggan', 'Sizes, profiles and logos made to customer requirements')],
                ],
                'note' => $t('TKDN = Tingkat Komponen Dalam Negeri. Sumber: profil perusahaan PT IKN.', 'TKDN = local content level (Tingkat Komponen Dalam Negeri). Source: PT IKN company profile.'),
            ]],
            ['key' => 'sertifikasi', 'type' => 'certificates', 'content' => [
                'label' => $t('/ Sertifikasi', '/ Certifications'),
                'heading' => $t('Sertifikat dan dokumen kepatuhan.', 'Certificates and compliance documents.'),
                'layout' => 'cards',
                'empty_text' => $t('Belum ada sertifikat yang dipublikasikan.', 'No certificates published yet.'),
            ]],
            ['key' => 'cta', 'type' => 'cta', 'content' => [
                'label' => $t('/ Data teknis', '/ Technical data'),
                'title' => $t('Butuh lembar spesifikasi atau data uji?', 'Need a specification sheet or test data?'),
                'body' => $t('Kirim aplikasi dan jumlah kebutuhan Anda. Tim kami akan menyiapkan dokumen dan penawarannya.', 'Send us your application and quantity. Our team will prepare the documents and a quotation.'),
                'button_label' => $t('Hubungi tim kami', 'Contact our team'),
                'button_url' => '/kontak',
                'secondary_label' => $t('Unduh dokumen', 'Download documents'),
                'secondary_url' => '/bisnis#unduhan',
            ]],
        ];
    }

    /**
     * Section halaman Keberlanjutan satu halaman (anchor = key); dipakai juga oleh migrasi penggabungan sub-halaman.
     * Anchor menu: #esg, #sertifikat, #pelanggan, #whistleblowing, #reach. Hanya fakta dari sumber klien (brosur:
     * 100% karet alam; profil: jarak bahan baku, APD, sertifikasi boots; bagan organisasi: SPI, pemeliharaan lingkungan).
     */
    public static function sustainabilitySections(callable $t, string $reachUrl = '/keberlanjutan#sertifikat'): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Keberlanjutan', '/ Sustainability'),
                'title' => $t('Tumbuh bertanggung jawab, menciptakan nilai jangka panjang.', 'Growing responsibly, creating lasting value.'),
                'lead' => $t(
                    'Kami meyakini pertumbuhan industri dan tanggung jawab lingkungan harus berjalan beriringan. Melalui praktik manufaktur yang bertanggung jawab, perbaikan berkelanjutan, serta komitmen kepada karyawan dan masyarakat, kami berupaya menciptakan nilai jangka panjang.',
                    'We believe industrial growth and environmental responsibility must go hand in hand. Through responsible manufacturing practices, continuous improvement, and a commitment to our people and communities, we strive to create lasting value.'
                ),
                'media' => self::headerMedia(['kebun-karet-1.jpg', 'pohon-karet-sadap.jpg']),
                'interval' => 7,
                'layout' => 'cover',
                'breadcrumb' => false,
            ]],
            ['key' => 'lingkungan', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Tanggung jawab lingkungan', '/ Environmental responsibility'),
                'heading' => $t('Karet alam, dipakai dengan cermat.', 'Natural rubber, used with care.'),
                'body' => $t(
                    "Karet alam adalah bahan baku terbarukan dan menjadi dasar semua produk IKN. Resiprene 35 dibuat dari 100% karet alam, dan pabrik Resiprene berjarak 36 km dari sumber karetnya di Gunung Para, sehingga jarak angkut bahan baku tetap pendek.\n\nKedua pabrik memiliki petugas pemeliharaan lingkungan di tim teknisnya. Kami berupaya memakai bahan baku secara efisien, mengelola limbah produksi secara terkendali, dan menjaga efisiensi energi pada proses hilir.",
                    "Natural rubber is a renewable raw material and the basis of every IKN product. Resiprene 35 is made from 100% natural rubber, and the Resiprene plant sits 36 km from its rubber source at Gunung Para, which keeps raw material transport short.\n\nBoth plants have environmental maintenance staff in their technical teams. We aim to use raw material efficiently, manage production waste in a controlled way and keep energy use efficient in downstream processing."
                ),
                'button_label' => $t('', ''),
                'button_url' => '',
                'image' => MediaSeeder::id('kebun-karet-2.jpg'),
                'image_alt' => $t('Perkebunan karet di Sumatera Utara', 'Rubber plantation in North Sumatra'),
                'image_side' => 'right',
                'visual_label' => '/ 100% natural rubber',
                'visual_mark' => '',
            ]],
            ['key' => 'k3', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Keselamatan & kesehatan kerja', '/ Occupational health & safety'),
                'heading' => $t('Kerja aman, di pabrik dan di kebun.', 'Safe work, on the plant floor and in the field.'),
                'body' => $t(
                    "Kami berupaya mewujudkan tempat kerja yang sehat dan aman di kedua pabrik. Tim produksi bekerja dengan alat pelindung diri, termasuk helm, masker, dan sarung tangan, saat menangani bahan baku.\n\nIKN juga membuat alat pelindung diri bagi pekerja kebun: sarung egrek, sarung dodos dan kampak, pelindung stick alloy pemanen dari kabel listrik, serta sepatu boots. Safety boots kami tersertifikasi CE EN 20345:2011 dengan toe cap 200 joule.",
                    "We work toward a healthy and safe workplace at both plants. Our production teams handle raw material in protective equipment, including helmets, masks and gloves.\n\nIKN also makes protective equipment for plantation workers: sickle covers, dodos and axe sheaths, guards that protect alloy harvesting poles from power lines, and rubber boots. Our safety boots are CE EN 20345:2011 approved with a 200 joule toe cap."
                ),
                'button_label' => $t('', ''),
                'button_url' => '',
                'image' => MediaSeeder::id('produksi-karet-1.webp'),
                'image_alt' => $t('Pekerja dengan helm dan masker memotong slab karet', 'Workers in helmets and masks cutting rubber slabs'),
                'image_side' => 'left',
                'visual_label' => '/ K3 · OHS',
                'visual_mark' => '',
            ]],
            ['key' => 'tata-kelola', 'type' => 'pillars', 'content' => [
                'label' => $t('/ Tata kelola perusahaan yang baik', '/ Good corporate governance'),
                'heading' => $t('Struktur yang jelas, pelaporan yang terbuka.', 'Clear structure, open reporting.'),
                'items' => [
                    ['key' => 'organ', 'icon' => 'compass', 'title' => $t('Organ perusahaan', 'Governing bodies'), 'body' => $t('IKN dijalankan oleh RUPS, Dewan Komisaris yang mencakup komisaris independen, dan Direktur, mengikuti standar induk usahanya, PT Perkebunan Nusantara III (Persero).', 'IKN is governed by the General Meeting of Shareholders, a Board of Commissioners that includes an independent commissioner, and a Director, following the standards of its parent, PT Perkebunan Nusantara III (Persero).'), 'points' => []],
                    ['key' => 'spi', 'icon' => 'search', 'title' => $t('Pengawasan intern', 'Internal audit'), 'body' => $t('Satuan Pengawasan Intern (SPI) melapor langsung kepada Direktur.', 'The Internal Audit Unit (Satuan Pengawasan Intern) reports directly to the Director.'), 'points' => []],
                    ['key' => 'wbs', 'icon' => 'bell', 'title' => $t('Whistle Blowing System', 'Whistle Blowing System'), 'body' => $t('Siapa pun dapat melaporkan dugaan korupsi, suap, benturan kepentingan, penyalahgunaan wewenang, serta pelanggaran prosedur dan keselamatan. Identitas pelapor dijaga kerahasiaannya.', 'Anyone can report suspected corruption, bribery, conflicts of interest, abuse of authority, or procedure and safety violations. Reporters’ identities are kept confidential.'), 'points' => []],
                    ['key' => 'akhlak', 'icon' => 'award', 'title' => $t('Nilai AKHLAK', 'AKHLAK values'), 'body' => $t('Pekerjaan di IKN berpedoman pada nilai inti AKHLAK: Amanah, Kompeten, Harmonis, Loyal, Adaptif, dan Kolaboratif.', 'Work at IKN is guided by the AKHLAK core values: Amanah, Kompeten, Harmonis, Loyal, Adaptif and Kolaboratif.'), 'points' => []],
                ],
            ]],
            ['key' => 'esg', 'type' => 'pillars', 'content' => [
                'label' => $t('/ Inisiatif ESG', '/ ESG initiatives'),
                'heading' => $t('Komitmen lingkungan, sosial, dan tata kelola.', 'Our environmental, social and governance commitments.'),
                'items' => [
                    ['key' => 'lingkungan', 'icon' => 'leaf', 'title' => $t('Lingkungan', 'Environment'), 'body' => $t('Mengolah karet alam secara bertanggung jawab di setiap tahap produksi.', 'Processing natural rubber responsibly at every production stage.'), 'points' => self::textItems($t, [
                        ['Bahan baku karet alam dari Sumatera Utara', 'Natural rubber raw material from North Sumatra'],
                        ['Pengelolaan limbah produksi yang terkendali', 'Controlled production waste management'],
                        ['Efisiensi energi pada proses hilir', 'Energy efficiency in downstream processing'],
                    ])],
                    ['key' => 'sosial', 'icon' => 'handshake', 'title' => $t('Sosial', 'Social'), 'body' => $t('Mengembangkan karyawan dan bekerja sama dengan perkebunan serta mitra lokal.', 'Developing our people and working with plantations and local partners.'), 'points' => self::textItems($t, [
                        ['Pengembangan SDM berlandaskan nilai AKHLAK', 'People development based on the AKHLAK values'],
                        ['Kemitraan dengan perkebunan dan mitra lokal', 'Partnerships with plantations and local partners'],
                        ['Tempat kerja yang sehat dan aman', 'A healthy and safe workplace'],
                    ])],
                    ['key' => 'tata-kelola', 'icon' => 'gear', 'title' => $t('Tata Kelola', 'Governance'), 'body' => $t('Menjalankan Good Corporate Governance sebagai anak perusahaan PTPN III.', 'Practising Good Corporate Governance as a PTPN III subsidiary.'), 'points' => self::textItems($t, [
                        ['Prinsip Good Corporate Governance (GCG)', 'Good Corporate Governance (GCG) principles'],
                        ['Pengawasan intern dan Whistle Blowing System', 'Internal audit and a Whistle Blowing System'],
                        ['Kepatuhan pada standar induk usaha', 'Compliance with the parent company’s standards'],
                    ])],
                ],
            ]],
            ['key' => 'reach', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ REACH Compliance', '/ REACH Compliance'),
                'heading' => $t('Terdaftar REACH untuk ekspor ke Uni Eropa.', 'REACH-registered for export to the European Union.'),
                'body' => $t(
                    "REACH (Registration, Evaluation, Authorisation and Restriction of Chemicals) adalah regulasi Uni Eropa tentang keamanan bahan kimia. Resiprene produksi PT Industri Karet Nusantara telah memenuhi persyaratan registrasi REACH.\n\nDengan registrasi ini Resiprene bisa dipasok ke produsen coating dan cat kapal di Uni Eropa. Sertifikatnya dapat diunduh dari tombol di bawah.",
                    "REACH (Registration, Evaluation, Authorisation and Restriction of Chemicals) is the European Union regulation on chemical safety. Resiprene made by PT Industri Karet Nusantara meets the REACH registration requirements.\n\nWith this registration Resiprene can be supplied to coating and marine paint makers in the European Union. Download the certificate with the button below."
                ),
                'button_label' => $t('Sertifikat REACH', 'REACH certificate'),
                'button_url' => $reachUrl,
                'visual_label' => '/ EU REACH',
                'visual_mark' => 'REACH',
            ]],
            ['key' => 'sertifikat', 'type' => 'certificates', 'content' => [
                'label' => $t('/ Sertifikat', '/ Certificates'),
                'heading' => $t('Sertifikat dan dokumen kepatuhan.', 'Certificates and compliance documents.'),
                'layout' => 'cards',
                'empty_text' => $t('Belum ada sertifikat yang dipublikasikan.', 'No certificates published yet.'),
            ]],
            ['key' => 'pelanggan', 'type' => 'customer_logos', 'content' => [
                'label' => $t('/ Pelanggan Kami', '/ Our Customers'),
                'heading' => $t('Mitra di perkebunan dan industri.', 'Partners in plantations and industry.'),
                'lead' => $t(
                    'Barang karet kami dipasok ke unit kebun dan pabrik PT Perkebunan Nusantara II, III, IV, dan V serta PT Socfin Indonesia. Daftar lengkapnya ada di halaman Kemitraan.',
                    'Our rubber articles are supplied to estate and mill units of PT Perkebunan Nusantara II, III, IV and V and PT Socfin Indonesia. The full list is on the Partnership page.'
                ),
            ]],
            ['key' => 'whistleblowing', 'type' => 'info_blocks', 'content' => [
                'label' => $t('/ Whistle Blowing System', '/ Whistle Blowing System'),
                'heading' => $t('Laporkan dugaan pelanggaran.', 'Report suspected misconduct.'),
                'blocks' => [
                    ['label' => $t('/ Tentang WBS', '/ About the WBS'), 'body' => $t('Whistle Blowing System (WBS) adalah kanal pelaporan dugaan pelanggaran di lingkungan PT Industri Karet Nusantara. Identitas pelapor dijaga kerahasiaannya sesuai kebijakan perusahaan.', 'The Whistle Blowing System (WBS) is the channel for reporting suspected misconduct at PT Industri Karet Nusantara. The reporter’s identity is kept confidential in line with company policy.'), 'points' => []],
                    ['label' => $t('/ Yang dapat dilaporkan', '/ What can be reported'), 'body' => $t('', ''), 'points' => [
                        ['text' => $t('Korupsi, suap, atau gratifikasi', 'Corruption, bribery, or gratuities')],
                        ['text' => $t('Benturan kepentingan', 'Conflicts of interest')],
                        ['text' => $t('Pelanggaran prosedur & keselamatan', 'Procedure and safety violations')],
                        ['text' => $t('Penyalahgunaan wewenang', 'Abuse of authority')],
                    ]],
                ],
            ]],
            ['key' => 'wbs-form', 'type' => 'wbs_form', 'content' => [
                'label' => $t('/ Kirim laporan', '/ Submit a report'),
                'success_title' => $t('Laporan tercatat.', 'Report recorded.'),
                'success_body' => $t('Simpan kode ini untuk menanyakan tindak lanjut laporan. Laporan Anda akan ditinjau tim terkait secara rahasia.', 'Keep this code to follow up on your report. Your report will be reviewed confidentially by the relevant team.'),
            ]],
        ];
    }

    /** Section halaman Berita & Media (/media): berita terbaru, kegiatan, galeri, dan video. */
    public static function mediaSections(callable $t): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Berita & Media', '/ News & Media'),
                'title' => $t('Berita, kegiatan, dan media IKN.', 'News, activities and media from IKN.'),
                'lead' => $t('Ikuti PT Industri Karet Nusantara lewat berita perusahaan serta foto dan video dari pabrik, perkebunan, dan kegiatan kami.', 'Follow PT Industri Karet Nusantara through company news and photos and videos from our plants, plantations and activities.'),
                'media' => self::headerMedia(['pabrik-udara-2.jpg']),
                'interval' => 6,
                'layout' => 'cover',
                'breadcrumb' => false,
            ]],
            ['key' => 'berita-terbaru', 'type' => 'latest_news', 'content' => [
                'label' => $t('/ Berita terbaru', '/ Latest news'),
                'heading' => $t('Berita & kabar terbaru.', 'Latest news & updates.'),
                'count' => 3,
                'link_label' => $t('Semua berita', 'All news'),
                'link_url' => '/berita',
            ]],
            ['key' => 'kegiatan', 'type' => 'image_grid', 'content' => [
                'label' => $t('/ Kegiatan', '/ Activities'),
                'heading' => $t('Keseharian di pabrik kami.', 'A day’s work at our plants.'),
                'lead' => $t('Dari pemeriksaan bahan baku sampai pemuatan barang jadi.', 'From raw material checks to loading finished goods.'),
                'link_label' => $t('Berita kegiatan', 'Activity news'),
                'link_url' => '/berita?category=kegiatan',
                'items' => self::mediaItems([
                    'produksi-karet-2.jpg' => $t('Pemeriksaan bahan baku karet', 'Checking rubber raw material'),
                    'produksi-karet-1.webp' => $t('Pemotongan slab karet', 'Cutting rubber slabs'),
                    'bahan-baku-gudang.jpg' => $t('Bahan baku karet di rak penyimpanan', 'Rubber raw material on storage racks'),
                    'pengemasan-muat-1.jpg' => $t('Pemuatan produk dalam kemasan karung', 'Loading bagged products'),
                    'pengemasan-muat-2.jpg' => $t('Pemeriksaan muatan sebelum pengiriman', 'Checking the load before shipment'),
                ], 'image', 'caption'),
            ]],
            ['key' => 'galeri', 'type' => 'image_grid', 'content' => [
                'label' => $t('/ Galeri', '/ Gallery'),
                'heading' => $t('Pabrik, fasilitas, dan perkebunan.', 'Plants, facilities and plantations.'),
                'lead' => $t('', ''),
                'link_label' => $t('Buka galeri lengkap', 'Open the full gallery'),
                'link_url' => '/galeri',
                'items' => self::mediaItems([
                    'gedung-kantor-udara.jpg' => $t('Foto udara gedung PT Industri Karet Nusantara', 'Aerial view of the PT Industri Karet Nusantara building'),
                    'pabrik-udara-2.jpg' => $t('Foto udara pabrik PT IKN di tengah perkebunan', 'Aerial view of a PT IKN plant among plantations'),
                    'kebun-karet-1.jpg' => $t('Perkebunan karet', 'Rubber plantation'),
                    'pohon-karet-sadap.jpg' => $t('Pohon karet yang disadap', 'A tapped rubber tree'),
                    'gedung-rubber-industry.jpg' => $t('Gedung PT Industri Karet Nusantara (Rubber Industry)', 'PT Industri Karet Nusantara (Rubber Industry) building'),
                    'papan-pabrik-resiprene.jpg' => $t('Papan nama Pabrik Resiprene Sei Bamban', 'Sign of the Sei Bamban Resiprene plant'),
                ], 'image', 'caption'),
            ]],
            ['key' => 'video', 'type' => 'video_gallery', 'content' => [
                'label' => $t('/ Video', '/ Video'),
                'heading' => $t('Profil perusahaan dalam video.', 'The company profile on video.'),
                'videos' => [
                    ['youtube_id' => 'FGJQW6l2hrk', 'title' => $t('Company Profile PT Industri Karet Nusantara', 'PT Industri Karet Nusantara company profile'), 'desc' => $t('Fasilitas produksi, sejarah, serta visi dan misi PT IKN.', 'Production facilities, history, and the vision and mission of PT IKN.')],
                ],
            ]],
        ];
    }

    /**
     * Section halaman Kemitraan (/kemitraan, 2026-11-04). Daftar pelanggan dari COMPANY PROFILE PT IKN.pptx (slide
     * "Our Costumer", Rubber Articles) dan SLIDE SHOW RESIPRENE35.pptx (pelanggan Resiprene 35 per negara).
     */
    public static function partnershipSections(callable $t): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Kemitraan', '/ Partnership'),
                'title' => $t('Membangun kemitraan industri yang kuat.', 'Building strong industrial partnerships.'),
                'lead' => $t(
                    'IKN memasok perusahaan perkebunan, pabrik kelapa sawit, dan produsen coating di Indonesia dan luar negeri. Sampaikan kebutuhan Anda, dan tim marketing kami akan menjawab dengan spesifikasi, harga, dan pilihan pengiriman.',
                    'IKN supplies plantation companies, palm oil mills and coating manufacturers in Indonesia and abroad. Tell us what you need, and our marketing team will reply with specifications, pricing and delivery options.'
                ),
                'media' => self::headerMedia(['pengemasan-muat-1.jpg']),
                'interval' => 6,
                'layout' => 'cover',
                'breadcrumb' => false,
            ]],
            ['key' => 'pelanggan', 'type' => 'customer_logos', 'content' => [
                'label' => $t('/ Pelanggan Rubber Articles', '/ Rubber Articles customers'),
                'heading' => $t('Dipercaya grup perkebunan di Sumatera.', 'Trusted by plantation groups across Sumatra.'),
                'lead' => $t(
                    'Barang karet kami dipasok ke unit kebun dan pabrik PT Perkebunan Nusantara II, III, IV, dan V serta PT Socfin Indonesia.',
                    'Our rubber articles are supplied to estate and mill units of PT Perkebunan Nusantara II, III, IV and V and PT Socfin Indonesia.'
                ),
                'layout' => 'marquee',
            ]],
            // Pelanggan Resiprene 35 per negara (SLIDE SHOW RESIPRENE35.pptx klien); titik peta = kota industri utama negara itu.
            ['key' => 'pelanggan-resiprene', 'type' => 'customer_map', 'content' => [
                'label' => $t('/ Pelanggan Resiprene 35', '/ Resiprene 35 customers'),
                'heading' => $t('Dipakai produsen coating di empat benua.', 'Used by coating makers on four continents.'),
                'lead' => $t('Resiprene 35 dikirim dari Pelabuhan Belawan ke produsen cat, tinta, coating, dan pita perekat di Asia, Eropa, Timur Tengah, dan Amerika.', 'Resiprene 35 ships from Belawan port to paint, ink, coating and adhesive tape makers in Asia, Europe, the Middle East and the Americas.'),
                'origin_label' => $t('Belawan, Indonesia', 'Belawan, Indonesia'),
                'items' => [
                    ['region' => 'asia', 'country' => $t('Indonesia', 'Indonesia'), 'geo' => ['lat' => -6.2, 'lng' => 106.85], 'customers' => self::customerList('Unichem, PT Wan Mei, PT Java Agro Timber Investama')],
                    ['region' => 'asia', 'country' => $t('Malaysia', 'Malaysia'), 'geo' => ['lat' => 3.14, 'lng' => 101.69], 'customers' => self::customerList('Chemzone, Stallion Chemical, VE-GE')],
                    ['region' => 'asia', 'country' => $t('Thailand', 'Thailand'), 'geo' => ['lat' => 13.76, 'lng' => 100.5], 'customers' => self::customerList('CMS Alliance Co. Ltd, Innovachem, Selic, Megachem')],
                    ['region' => 'asia', 'country' => $t('Vietnam', 'Vietnam'), 'geo' => ['lat' => 10.82, 'lng' => 106.63], 'customers' => self::customerList('Huy An, Thinh Phat')],
                    ['region' => 'asia', 'country' => $t('Tiongkok', 'China'), 'geo' => ['lat' => 31.23, 'lng' => 121.47], 'customers' => self::customerList('Shanghai Recky')],
                    ['region' => 'asia', 'country' => $t('Taiwan', 'Taiwan'), 'geo' => ['lat' => 25.03, 'lng' => 121.56], 'customers' => self::customerList('Champion Ink, Euroland')],
                    ['region' => 'asia', 'country' => $t('Korea Selatan', 'South Korea'), 'geo' => ['lat' => 37.57, 'lng' => 126.98], 'customers' => self::customerList('Hanval')],
                    ['region' => 'middle_east', 'country' => $t('Uni Emirat Arab', 'United Arab Emirates'), 'geo' => ['lat' => 25.2, 'lng' => 55.27], 'customers' => self::customerList('Tawazon Chemical')],
                    ['region' => 'europe', 'country' => $t('Italia', 'Italy'), 'geo' => ['lat' => 45.46, 'lng' => 9.19], 'customers' => self::customerList('Eigenmann & Veronelli, Eigenmann Iberica, Fenzi, Resine Italiane')],
                    ['region' => 'europe', 'country' => $t('Belgia', 'Belgium'), 'geo' => ['lat' => 50.85, 'lng' => 4.35], 'customers' => self::customerList('Ter Hell')],
                    ['region' => 'europe', 'country' => $t('Spanyol', 'Spain'), 'geo' => ['lat' => 40.42, 'lng' => -3.7], 'customers' => self::customerList('Trinity Paints')],
                    ['region' => 'americas', 'country' => $t('Amerika Serikat', 'United States'), 'geo' => ['lat' => 35.23, 'lng' => -80.84], 'customers' => self::customerList('Tesa Tape')],
                    ['region' => 'americas', 'country' => $t('Brasil', 'Brazil'), 'geo' => ['lat' => -23.55, 'lng' => -46.63], 'customers' => self::customerList('Promaflex')],
                ],
            ]],
            // info_blocks + contact_form berdampingan = satu blok dua kolom (ContactGrid), anchor = key.
            ['key' => 'kerja-sama', 'type' => 'info_blocks', 'content' => [
                'label' => $t('/ Permintaan kerja sama', '/ Business inquiry'),
                'heading' => $t('Kontrak pasokan dan kemitraan.', 'Supply agreements and partnerships.'),
                'blocks' => [
                    ['label' => $t('/ Mitra kami', '/ Who we work with'), 'body' => $t('', ''), 'points' => self::textItems($t, [
                        ['Perusahaan perkebunan dan pabrik kelapa sawit', 'Plantation companies and palm oil mills'],
                        ['Produsen cat, tinta, coating, dan pita perekat', 'Paint, ink, coating and adhesive tape manufacturers'],
                        ['Pembeli industri yang membutuhkan komponen karet khusus', 'Industrial buyers that need custom rubber parts'],
                        ['Pembeli ekspor dengan syarat FOB Belawan atau CIF', 'Export buyers on FOB Belawan or CIF terms'],
                    ])],
                    ['label' => $t('/ Yang perlu disertakan', '/ What to include'), 'body' => $t('', ''), 'points' => self::textItems($t, [
                        ['Nama perusahaan dan negara', 'Company name and country'],
                        ['Produk, aplikasi, dan spesifikasi atau gambar teknik', 'Product, application and specification or drawing'],
                        ['Perkiraan jumlah dan jadwal pengiriman', 'Estimated quantity and delivery schedule'],
                        ['Tujuan dan syarat pengiriman yang diinginkan', 'Destination and preferred delivery terms'],
                    ])],
                ],
            ]],
            ['key' => 'form', 'type' => 'contact_form', 'content' => [
                'label' => $t('/ Kirim permintaan', '/ Send an inquiry'),
                'success_title' => $t('Terima kasih.', 'Thank you.'),
                'success_body' => $t('Permintaan Anda sudah tercatat. Tim marketing kami akan menghubungi Anda secepatnya.', 'Your inquiry has been recorded. Our marketing team will get back to you shortly.'),
            ]],
            ['key' => 'permintaan-produk', 'type' => 'link_cards', 'content' => [
                'label' => $t('/ Permintaan produk', '/ Product inquiry'),
                'heading' => $t('Menanyakan produk tertentu.', 'Asking about a specific product.'),
                'lead' => $t('Untuk satu produk, pilih jalur yang paling sesuai dengan kebutuhan Anda.', 'For a single product, choose the route that fits what you need.'),
                'items' => [
                    ['icon' => 'bag', 'title' => $t('Pesan dari katalog', 'Order from the catalog'), 'body' => $t('Pelanggan perusahaan yang terdaftar bisa melihat harga dan stok, lalu memesan online.', 'Registered business customers can see prices and stock and order online.'), 'url' => '/catalog', 'link_label' => $t('Buka katalog', 'Open catalog')],
                    ['icon' => 'tag', 'title' => $t('Minta penawaran', 'Request a quotation'), 'body' => $t('Produk bertanda Penawaran, seperti membran filter press dan kopling karet, diberi harga sesuai permintaan.', 'Products marked Quote, such as filter press membranes and rubber couplings, are priced on request.'), 'url' => '/kontak', 'link_label' => $t('Kirim permintaan', 'Send a request')],
                    ['icon' => 'package', 'title' => $t('Brosur & safety data sheet', 'Brochures & safety data'), 'body' => $t('Unduh brosur produk dan safety data sheet Resiprene 35.', 'Download product brochures and the Resiprene 35 safety data sheet.'), 'url' => '/bisnis#unduhan', 'link_label' => $t('Ke unduhan', 'Go to downloads')],
                    ['icon' => 'chat', 'title' => $t('Live chat & WhatsApp', 'Live chat & WhatsApp'), 'body' => $t('Pakai tombol di pojok kanan bawah halaman untuk menghubungi tim marketing kami.', 'Use the buttons at the bottom right of the page to reach our marketing team.'), 'url' => '/kontak', 'link_label' => $t('Info kontak', 'Contact details')],
                ],
            ]],
        ];
    }

    /** Section halaman Hubungi Kami (/kontak): kantor pusat, lokasi pabrik, informasi kontak + peta, formulir. */
    public static function contactSections(callable $t): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Hubungi Kami', '/ Contact Us'),
                'title' => $t('Bicara dengan tim IKN.', 'Talk to the IKN team.'),
                'lead' => $t(
                    'Untuk harga, spesifikasi teknis, atau kunjungan pabrik, isi formulir di bawah, hubungi WhatsApp marketing kami, atau datang ke kantor pusat kami di Medan.',
                    'For prices, technical specifications or a plant visit, use the form below, message our marketing team on WhatsApp, or visit our head office in Medan.'
                ),
                'media' => self::headerMedia(['kantor-direksi.png']),
                'interval' => 6,
                'layout' => 'cover',
                'breadcrumb' => false,
            ]],
            ['key' => 'kantor-pusat', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Kantor pusat', '/ Head office'),
                'heading' => $t('Jl. Medan–Tanjung Morawa Km 9,5, Medan.', 'Jl. Medan–Tanjung Morawa Km 9.5, Medan.'),
                'body' => $t(
                    "Kantor pusat berada satu lokasi dengan pabrik Rubber Articles di Jalan Lintas Sumatera, 9,5 km dari pusat kota Medan dan 1 km dari pintu tol Amplas.\n\nAlamat: Jl. Medan–Tanjung Morawa Km 9,5, Medan 20148, Sumatera Utara, Indonesia. Pelabuhan Belawan berjarak 33 km dan Bandara Internasional Kualanamu 29 km.",
                    "The head office shares its site with the Rubber Articles plant on the Trans-Sumatra highway, 9.5 km from Medan city centre and 1 km from the Amplas toll gate.\n\nAddress: Jl. Medan–Tanjung Morawa Km 9.5, Medan 20148, North Sumatra, Indonesia. Belawan port is 33 km away and Kualanamu International Airport 29 km."
                ),
                'button_label' => $t('Buka di peta', 'Open in maps'),
                'button_url' => 'https://www.google.com/maps?q='.self::GEO_HEAD_OFFICE['lat'].','.self::GEO_HEAD_OFFICE['lng'],
                'image' => MediaSeeder::id('gedung-kantor-udara.jpg'),
                'image_alt' => $t('Foto udara kantor pusat PT IKN', 'Aerial view of the PT IKN head office'),
                'image_side' => 'right',
                'visual_label' => '/ Medan',
                'visual_mark' => '',
            ]],
            ['key' => 'lokasi-pabrik', 'type' => 'pillars', 'content' => [
                'label' => $t('/ Lokasi pabrik', '/ Factory locations'),
                'heading' => $t('Cara menuju pabrik kami.', 'Getting to our plants.'),
                'items' => [
                    ['key' => 'pabrik-rubber-articles', 'icon' => 'pin', 'title' => $t('Pabrik Rubber Articles', 'Rubber Articles plant'), 'body' => $t('Jl. Medan–Tanjung Morawa Km 9,5, Medan 20148, Sumatera Utara.', 'Jl. Medan–Tanjung Morawa Km 9.5, Medan 20148, North Sumatra.'), 'points' => self::textItems($t, [
                        ['1 km dari pintu tol Amplas; 7,1 km dari pintu tol Tanjung Morawa', '1 km from the Amplas toll gate; 7.1 km from the Tanjung Morawa toll gate'],
                        ['33 km ke Pelabuhan Belawan', '33 km to Belawan port'],
                        ['29 km ke Bandara Internasional Kualanamu', '29 km to Kualanamu International Airport'],
                    ])],
                    ['key' => 'pabrik-resiprene', 'icon' => 'pin', 'title' => $t('Pabrik Resiprene', 'Resiprene plant'), 'body' => $t('Sei Bamban Estate, Kec. Sei Bamban, Kab. Serdang Bedagai 20695, Sumatera Utara.', 'Sei Bamban Estate, Sei Bamban District, Serdang Bedagai Regency 20695, North Sumatra.'), 'points' => self::textItems($t, [
                        ['6,5 km dari pintu tol Sei Rampah; 1,5 km dari Jalan Lintas Sumatera Kampung Pon', '6.5 km from the Sei Rampah toll gate; 1.5 km from the Trans-Sumatra highway at Kampung Pon'],
                        ['1 km dari stasiun kereta api Bamban', '1 km from Bamban railway station'],
                        ['85 km ke Pelabuhan Belawan lewat tol; 58,7 km ke Bandara Kualanamu', '85 km to Belawan port by toll road; 58.7 km to Kualanamu Airport'],
                    ])],
                ],
            ]],
            ['key' => 'contact-info', 'type' => 'contact_info', 'content' => [
                'locations' => [
                    // geo = perkiraan titik dari alamat; admin dapat menggeser pin di Pengaturan section.
                    ['name' => $t('Kantor Pusat & Pabrik Rubber Articles', 'Head Office & Rubber Articles Plant'), 'address' => 'Jl. Medan – Tanjung Morawa Km 9,5, Medan 20148, Sumatera Utara, Indonesia', 'phones' => [['number' => '+62 61 786 7356'], ['number' => '+62 811 648 0083']], 'geo' => self::GEO_HEAD_OFFICE],
                    ['name' => $t('Pabrik Resiprene', 'Resiprene Plant'), 'address' => 'Sei Bamban Estate, Kec. Sei Bamban, Kab. Serdang Bedagai 20695, Sumatera Utara, Indonesia', 'phones' => [], 'geo' => self::GEO_RESIPRENE_PLANT],
                ],
                'emails' => [['address' => 'ikn@ptikn.com'], ['address' => 'gpihk_prpne@ikn.co.id']],
                // icon null = ikon bawaan FE menurut platform; admin dapat mengunggah ikon sendiri (PNG/SVG).
                'social' => [
                    ['label' => 'Instagram', 'handle' => '@ikn.rubber', 'url' => 'https://instagram.com/ikn.rubber', 'icon' => null],
                    ['label' => 'YouTube', 'handle' => '@RubberIkn', 'url' => 'https://youtube.com/@RubberIkn', 'icon' => null],
                    ['label' => 'TikTok', 'handle' => '@iknrubber', 'url' => 'https://tiktok.com/@iknrubber', 'icon' => null],
                ],
                'background' => null, // foto latar blok kontak; kosong = gradien warna tema
            ]],
            ['key' => 'form', 'type' => 'contact_form', 'content' => [
                'label' => $t('/ Kirim pesan', '/ Send a message'),
                'success_title' => $t('Terima kasih.', 'Thank you.'),
                'success_body' => $t('Pesan Anda sudah tercatat. Tim kami akan menghubungi Anda secepatnya.', 'Your message has been recorded. Our team will get back to you shortly.'),
            ]],
        ];
    }

    /** Item slideshow kepala halaman dari berkas MediaSeeder yang ada (berkas hilang dilewati). */
    public static function headerMedia(array $files): array
    {
        $items = [];
        foreach ($files as $file) {
            if ($id = MediaSeeder::id($file)) {
                $items[] = ['file' => $id, 'caption' => ['id' => '', 'en' => '']];
            }
        }

        return $items;
    }

    /** Titik peta perkiraan (lat, lng) dari alamat; dipakai seeder dan migrasi pin peta. Admin dapat menggeser pin. */
    public const GEO_HEAD_OFFICE = ['lat' => 3.5387, 'lng' => 98.7467];
    public const GEO_RESIPRENE_PLANT = ['lat' => 3.3495, 'lng' => 99.0862];

    /** Tingkat (SectionDefinitions::ORG_LEVELS) per kunci simpul; kunci lain = pelaksana. Dipakai seeder dan migrasi. */
    public static function orgChartLevels(): array
    {
        $map = [
            'rups' => ['rups'],
            'komisaris' => ['komisaris'],
            'direksi' => ['direktur'],
            'sevp' => ['sevp'],
            'bagian' => ['spi', 'mop', 'kabag-pbs'],
            'sub' => ['aop-prn', 'aop-pra', 'kasub-pemasaran', 'kasub-bs'],
            'asisten' => ['spi-asisten', 'as-pemasaran', 'as-akun', 'as-pengadaan', 'as-sdm'],
            'mandor' => [
                'prn-krani1', 'prn-mandor-olah', 'prn-mandor-teknik', 'pra-mandor-olah', 'pra-mandor-teknik', 'pra-krani-adm',
                'krani1-pem-resin', 'krani1-pem-ra', 'krani1-akun-pajak', 'krani1-keu', 'krani1-pengadaan', 'krani1-ti',
                'krani1-sdm', 'krani1-umum', 'krani1-legal',
            ],
        ];
        $levels = [];
        foreach ($map as $level => $keys) {
            foreach ($keys as $key) {
                $levels[$key] = $level;
            }
        }

        return $levels;
    }

    /**
     * Section struktur organisasi (halaman Tentang, anchor #struktur-organisasi) dari SK Direksi IKN.DIR/SKPTS/7/2023
     * beserta bagan bagian (operasional pabrik, pemasaran & business support, SPI). Dipakai juga oleh migrasi.
     */
    /** Tonggak sejarah perusahaan (bagan "Sejarah Perusahaan" dari klien, 2026-10-01). Dipakai seeder dan migrasi data. */
    public static function historyItems(callable $t): array
    {
        return [
            [
                'year' => '1965',
                'media' => MediaSeeder::id('sejarah-ban-sepeda.jpg'),
                'name' => $t('Pabrik Ban Sepeda TAVIP (DATAK Sumatera Utara)', 'TAVIP Bicycle Tyre Factory (DATAK North Sumatra)'),
                'title' => $t('1965–1968', '1965–1968'),
                'body' => $t('Sejak didirikan, pengelolaannya oleh DATAK (Dana Tanaman Keras) Sumatera Utara dengan nama Pabrik Ban Sepeda TAVIP.', 'Since its founding, managed by DATAK (Dana Tanaman Keras) North Sumatra under the name TAVIP Bicycle Tyre Factory.'),
                'products' => $t('Ban sepeda luar dan dalam', 'Bicycle tyres and inner tubes'),
            ],
            [
                'year' => '1968',
                'media' => MediaSeeder::id('sejarah-karet-gelang.jpg'),
                'name' => $t('Industri Karet TAFIKA (PTP-II)', 'TAFIKA Rubber Industry (PTP-II)'),
                'title' => $t('1968–1971', '1968–1971'),
                'body' => $t('Sesuai Surat Keputusan Menteri Pertanian No. 175/KPTS/OP/8/1968, pengelolaannya beralih ke PT Perkebunan II dengan nama Industri Karet Tafika.', 'Under Minister of Agriculture Decree No. 175/KPTS/OP/8/1968, management passed to PT Perkebunan II under the name Tafika Rubber Industry.'),
                'products' => $t('Ban sepeda dan karet gelang', 'Bicycle tyres and rubber bands'),
            ],
            [
                'year' => '1971',
                'media' => MediaSeeder::id('sejarah-flexible-joint.jpg'),
                'name' => $t('KPB/PNP/PTP I–IX Sumut Aceh', 'KPB/PNP/PTP I–IX North Sumatra & Aceh'),
                'title' => $t('1971–1978', '1971–1978'),
                'body' => $t('Dengan Surat Keputusan Perwakilan B.C.U/PTP Wilayah I No. 24/49/1971 pengelolaan dialihkan kepada PT Perkebunan III; sesuai Surat Keputusan Dirjen Perkebunan No. 76/BCU.KPB/KPTS/1971 pengelolaannya beralih ke KPB/PNP/PTP I–IX Sumut Aceh.', 'By B.C.U/PTP Region I Representative Decree No. 24/49/1971 management moved to PT Perkebunan III; under Directorate General of Plantations Decree No. 76/BCU.KPB/KPTS/1971 it passed to KPB/PNP/PTP I–IX North Sumatra & Aceh.'),
                'products' => $t('Rubber articles, karet gelang, dan ban sepeda', 'Rubber articles, rubber bands and bicycle tyres'),
            ],
            [
                'year' => '1978',
                'media' => MediaSeeder::id('bahan-baku-gudang.jpg'),
                'name' => $t('Unit Kerja PT Perkebunan III', 'Business Unit of PT Perkebunan III'),
                'title' => $t('1978–1982', '1978–1982'),
                'body' => $t('Sesuai Surat Keputusan Menteri Pertanian No. 12/KPTS/UM/I/1978 pengelolaannya dialihkan kepada PT Perkebunan III.', 'Under Minister of Agriculture Decree No. 12/KPTS/UM/I/1978 management was transferred to PT Perkebunan III.'),
                'products' => $t('Rubber articles, karet gelang, dan compound', 'Rubber articles, rubber bands and compound'),
            ],
            [
                'year' => '1982',
                'media' => MediaSeeder::id('sejarah-conveyor-belt.jpg'),
                'name' => $t('Proyek Industri Karet PT Perkebunan III', 'Rubber Industry Project of PT Perkebunan III'),
                'title' => $t('1982–1989', '1982–1989'),
                'body' => $t('Peralihan nama menjadi Proyek Industri Karet PT Perkebunan III.', 'Renamed the Rubber Industry Project of PT Perkebunan III.'),
                'products' => $t('Rubber articles, karet gelang, compound, conveyor belt, dock fender, dan sarung tangan', 'Rubber articles, rubber bands, compound, conveyor belts, dock fenders and gloves'),
            ],
            [
                'year' => '1996',
                'media' => MediaSeeder::id('papan-pabrik-resiprene.jpg'),
                'name' => $t('Unit Kerja PT Perkebunan Nusantara III', 'Business Unit of PT Perkebunan Nusantara III'),
                'title' => $t('1996–2006', '1996–2006'),
                'body' => $t("Sesuai PP No. 8/1996 tanggal 14 Februari 1996, PT Perkebunan III, IV, dan V dilebur menjadi PT Perkebunan Nusantara III dan Pabrik Industri Karet menjadi salah satu unit kerjanya.\n\n2003–2004, berdasarkan SKPTS Direksi No. III.10/SKPTS/R/07.A/2003 tanggal 27 Januari 2003, usaha Pabrik Sarung Tangan dan Pabrik Karet Gelang tidak dioperasikan.\n\n2005–2006, berdasarkan SKPTS Direksi No. 3.08/SKPTS/01/2005 tanggal 10 Januari 2005, nama Pabrik Industri Karet PTPN III diubah menjadi Pabrik Rubber Thread dan Rubber Articles (PRTRA).", "Under Government Regulation No. 8/1996 of 14 February 1996, PT Perkebunan III, IV and V merged into PT Perkebunan Nusantara III and the Rubber Industry Plant became one of its business units.\n\nIn 2003–2004, by Board Decree No. III.10/SKPTS/R/07.A/2003 of 27 January 2003, the glove and rubber band plants were taken out of operation.\n\nIn 2005–2006, by Board Decree No. 3.08/SKPTS/01/2005 of 10 January 2005, the PTPN III Rubber Industry Plant was renamed the Rubber Thread and Rubber Articles Plant (PRTRA)."),
                'products' => $t('Rubber articles, conveyor belt, dock fender, sarung tangan, benang karet, dan karet gelang', 'Rubber articles, conveyor belts, dock fenders, gloves, rubber thread and rubber bands'),
            ],
            [
                'year' => $t('2006 s.d. Sekarang', '2006 – present')['id'],
                'media' => MediaSeeder::id('gedung-kantor-udara.jpg'),
                'name' => $t('PT Industri Karet Nusantara, Anak Perusahaan PT Perkebunan Nusantara III (Persero)', 'PT Industri Karet Nusantara, Subsidiary of PT Perkebunan Nusantara III (Persero)'),
                'title' => $t('Sejak 4 April 2006', 'Since 4 April 2006'),
                'body' => $t("Berdasarkan Akta Pendirian No. 4 Tahun 2006 oleh Notaris Syafnil Gani, SH, M.Hum, menjadi PT Industri Karet Nusantara, anak perusahaan PT Perkebunan Nusantara III (Persero).\n\nBerdasarkan keputusan RUPS RKAP 2017, Pabrik Rubber Thread dihentikan operasionalnya.", "By Deed of Establishment No. 4 of 2006 before Notary Syafnil Gani, SH, M.Hum, it became PT Industri Karet Nusantara, a subsidiary of PT Perkebunan Nusantara III (Persero).\n\nBy resolution of the 2017 RKAP shareholders' meeting, the Rubber Thread plant ceased operation."),
                'products' => $t('Rubber articles dan Resiprene', 'Rubber articles and Resiprene'),
            ],
        ];
    }

    public static function orgChartSection(callable $t): array
    {
        $levels = self::orgChartLevels();
        // Pejabat dari COMPANY PROFILE PT IKN.pptx (posisi Februari 2024); jabatan lain diisi admin.
        $holders = ['komisaris' => 'Husairi (Komisaris Utama), Marahalim Harahap (Komisaris Independen)', 'direktur' => 'Drs. J. Swondo', 'sevp' => 'Amalia Nasution'];
        $n = fn (string $key, string $parent, string $id, ?string $en = null) => [
            'key' => $key, 'parent' => $parent, 'title' => $t($id, $en ?? $id), 'holder' => $holders[$key] ?? '', 'level' => $levels[$key] ?? 'pelaksana',
        ];

        return ['key' => 'struktur', 'type' => 'org_chart', 'content' => [
            'label' => $t('/ Struktur organisasi', '/ Organisation structure'),
            'heading' => $t('Susunan organisasi PT IKN.', 'How PT IKN is organised.'),
            'lead' => $t('Sesuai Surat Keputusan Direksi tentang Struktur Organisasi PT Industri Karet Nusantara (2023). Klik jabatan untuk membuka bagian di bawahnya.', 'As set out in the Board of Directors’ decree on the organisation structure of PT Industri Karet Nusantara (2023). Click a position to open the units below it.'),
            'expand_depth' => 5,
            'nodes' => [
                $n('rups', '', 'RUPS', 'General Meeting of Shareholders'),
                $n('komisaris', 'rups', 'Dewan Komisaris', 'Board of Commissioners'),
                $n('direktur', 'komisaris', 'Direktur', 'Director'),
                $n('sevp', 'direktur', 'SEVP Operation'),
                $n('spi', 'direktur', 'Kepala Bagian Satuan Pengawasan Intern', 'Head of Internal Audit Unit'),
                $n('spi-asisten', 'spi', 'Asisten Satuan Pengawasan Intern', 'Internal Audit Assistant'),
                $n('mop', 'sevp', 'Manager Operasional Pabrik', 'Plant Operations Manager'),
                $n('kabag-pbs', 'sevp', 'Kepala Bagian Pemasaran dan Business Support', 'Head of Marketing & Business Support'),
                // Bagian operasional pabrik.
                $n('aop-prn', 'mop', 'Asisten Operasional Pabrik Resiprene', 'Resiprene Plant Operations Assistant'),
                $n('prn-krani1', 'aop-prn', 'Krani 1 Administrasi Umum dan Akuntansi PRN'),
                $n('prn-krani-akun', 'prn-krani1', 'Krani Akuntansi dan Umum'),
                $n('prn-pemel-kantor', 'prn-krani-akun', 'Pemeliharaan Kantor'),
                $n('prn-krani-adm', 'prn-krani1', 'Krani Administrasi Pabrik'),
                $n('prn-krani-gudang', 'prn-krani1', 'Krani Gudang dan Bea Cukai'),
                $n('prn-danton', 'prn-krani1', 'Danton Keamanan PRN'),
                $n('prn-pengamanan', 'prn-danton', 'Pengamanan'),
                $n('prn-mandor-olah', 'aop-prn', 'Mandor Pengolahan'),
                $n('prn-op-mixing', 'prn-mandor-olah', 'Operator Mixing'),
                $n('prn-pemb-mixing', 'prn-op-mixing', 'Pembantu Operator Mixing'),
                $n('prn-op-packing', 'prn-mandor-olah', 'Operator Packing'),
                $n('prn-pemb-packing', 'prn-op-packing', 'Pembantu Operator Packing'),
                $n('prn-analis', 'prn-mandor-olah', 'Analis Lab'),
                $n('prn-mandor-teknik', 'aop-prn', 'Mandor Teknik dan Maintenance'),
                $n('prn-op-toh', 'prn-mandor-teknik', 'Operator TOH'),
                $n('prn-pemb-toh', 'prn-op-toh', 'Pembantu Operator TOH'),
                $n('prn-op-forklift', 'prn-mandor-teknik', 'Operator Forklift dan Maintenance'),
                $n('prn-op-genset', 'prn-mandor-teknik', 'Operator Genset dan Waterpoll'),
                $n('prn-pemel-lingkungan', 'prn-op-genset', 'Pemeliharaan Lingkungan'),
                $n('aop-pra', 'mop', 'Asisten Operasional Pabrik Rubber Article', 'Rubber Article Plant Operations Assistant'),
                $n('pra-mandor-olah', 'aop-pra', 'Mandor Pengolahan PRA'),
                $n('pra-op-olah', 'pra-mandor-olah', 'Operator Pengolahan Pabrik RA'),
                $n('pra-pemb-op', 'pra-op-olah', 'Pembantu Operator'),
                $n('pra-mandor-teknik', 'aop-pra', 'Mandor Teknik dan Maintenance PRA'),
                $n('pra-op-teknik', 'pra-mandor-teknik', 'Operator Electrical, Forklift dan Maintenance'),
                $n('pra-pemb-teknik', 'pra-op-teknik', 'Pembantu Operator Teknik'),
                $n('pra-pemel-lingkungan', 'pra-mandor-teknik', 'Pemeliharaan Lingkungan'),
                $n('pra-krani-adm', 'aop-pra', 'Krani Administrasi Pabrik RA'),
                // Bagian pemasaran dan business support.
                $n('kasub-pemasaran', 'kabag-pbs', 'Kepala Sub Bagian Pemasaran', 'Head of Marketing Sub-division'),
                $n('as-pemasaran', 'kasub-pemasaran', 'Asisten Pemasaran', 'Marketing Assistant'),
                $n('krani1-pem-resin', 'as-pemasaran', 'Krani 1 Pemasaran Resin'),
                $n('krani-pem-resin', 'krani1-pem-resin', 'Krani Pemasaran Resin'),
                $n('krani1-pem-ra', 'as-pemasaran', 'Krani 1 Pemasaran Rubber Article'),
                $n('krani-pem-ra', 'krani1-pem-ra', 'Krani Pemasaran Rubber Article'),
                $n('kasub-bs', 'kabag-pbs', 'Kepala Sub Bagian Business Support', 'Head of Business Support Sub-division'),
                $n('as-akun', 'kasub-bs', 'Asisten Akuntansi dan Keuangan', 'Accounting & Finance Assistant'),
                $n('krani1-akun-pajak', 'as-akun', 'Krani 1 Akuntansi dan Pajak'),
                $n('krani-akuntansi', 'krani1-akun-pajak', 'Krani Akuntansi'),
                $n('krani-pajak', 'krani1-akun-pajak', 'Krani Pajak'),
                $n('krani-gudang-pra', 'krani1-akun-pajak', 'Krani Gudang PRA'),
                $n('krani1-keu', 'as-akun', 'Krani 1 Keuangan dan Anggaran'),
                $n('krani-kas', 'krani1-keu', 'Krani Kas dan Bank'),
                $n('krani-anggaran', 'krani1-keu', 'Krani Anggaran'),
                $n('as-pengadaan', 'kasub-bs', 'Asisten Pengadaan dan TI', 'Procurement & IT Assistant'),
                $n('krani1-pengadaan', 'as-pengadaan', 'Krani 1 Pengadaan'),
                $n('krani-pengadaan', 'krani1-pengadaan', 'Krani Pengadaan'),
                $n('krani1-ti', 'as-pengadaan', 'Krani 1 TI'),
                $n('krani-ti', 'krani1-ti', 'Krani TI'),
                $n('as-sdm', 'kasub-bs', 'Asisten SDM dan Umum', 'HR & General Affairs Assistant'),
                $n('krani1-sdm', 'as-sdm', 'Krani 1 SDM'),
                $n('krani-personalia', 'krani1-sdm', 'Krani Personalia'),
                $n('krani1-umum', 'as-sdm', 'Krani 1 Umum'),
                $n('driver', 'krani1-umum', 'Driver'),
                $n('krani-umum-pemel', 'krani1-umum', 'Krani Umum dan Pemeliharaan'),
                $n('pemel-kantor-pusat', 'krani-umum-pemel', 'Pemeliharaan Kantor Pusat / Lingkungan'),
                $n('krani1-legal', 'as-sdm', 'Krani 1 Legal dan Sekretariat'),
                $n('krani-dcc', 'krani1-legal', 'Krani DCC'),
                $n('sekretaris', 'krani1-legal', 'Sekretaris'),
                $n('danton-kandir', 'krani1-legal', 'Danton Keamanan Kandir dan RA'),
                $n('pengamanan-kandir', 'danton-kandir', 'Pengamanan'),
            ],
        ]];
    }

    /** Kartu tautan sub-halaman Keberlanjutan (hanya untuk migrasi 2026_09_29_000040; seeder tidak lagi memakainya). */
    public static function sustainabilityLinks(callable $t): array
    {
        return [
            'label' => $t('/ Selengkapnya', '/ Learn more'),
            'heading' => $t('Bukti komitmen kami.', 'Proof of our commitment.'),
            'lead' => $t('', ''),
            'items' => [
                ['icon' => 'shieldCheck', 'title' => $t('Sertifikat', 'Certificates'), 'body' => $t('ISO 37001 anti-penyuapan dan sertifikat mutu yang kami pegang.', 'ISO 37001 anti-bribery and the quality certificates we hold.'), 'url' => '/keberlanjutan#sertifikat', 'link_label' => $t('Lihat sertifikat', 'View certificates')],
                ['icon' => 'users', 'title' => $t('Pelanggan kami', 'Our customers'), 'body' => $t('Mitra lintas industri di dalam dan luar negeri.', 'Partners across industries at home and abroad.'), 'url' => '/keberlanjutan#pelanggan', 'link_label' => $t('Lihat pelanggan', 'View customers')],
                ['icon' => 'flask', 'title' => $t('REACH Compliance', 'REACH Compliance'), 'body' => $t('Kepatuhan regulasi bahan kimia Uni Eropa untuk Resiprene 35.', 'EU chemical regulation compliance for Resiprene 35.'), 'url' => '/keberlanjutan#reach', 'link_label' => $t('Baca selengkapnya', 'Read more')],
                ['icon' => 'quote', 'title' => $t('Whistle Blowing System', 'Whistle Blowing System'), 'body' => $t('Kanal resmi pelaporan dugaan pelanggaran; identitas pelapor dijaga.', 'Official channel for reporting suspected misconduct; the reporter’s identity is protected.'), 'url' => '/keberlanjutan#whistleblowing', 'link_label' => $t('Laporkan', 'Report')],
            ],
        ];
    }
}
