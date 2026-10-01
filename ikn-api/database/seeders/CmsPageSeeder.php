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
                'title' => $t('PT Industri Karet Nusantara — Pabrik Karet Industri & Resiprene 35 di Medan', 'PT Industri Karet Nusantara — Industrial Rubber Manufacturer & Resiprene 35, Medan'),
                'description' => $t('Produsen barang karet industri sejak 1965 di Medan: Resiprene 35 (cyclised rubber), sarung egrek, sepatu boots, rubber membrane. Pesan online langsung dari pabrik.', 'Industrial rubber manufacturer since 1965 in Medan, Indonesia: Resiprene 35 (cyclised rubber), harvesting sickle sheaths, boots, rubber membranes. Order online direct from the factory.'),
            ],
            'tentang' => [
                'title' => $t('Tentang PT IKN — Sejarah, Visi Misi & Struktur Organisasi', 'About PT IKN — History, Vision, Mission & Organisation'),
                'description' => $t('Profil PT Industri Karet Nusantara, anak perusahaan PTPN III: sejarah sejak 1965, visi misi, nilai AKHLAK, dan struktur organisasi pabrik karet di Medan.', 'Profile of PT Industri Karet Nusantara, a PTPN III subsidiary: history since 1965, vision, mission, AKHLAK values and organisation of the Medan rubber plant.'),
            ],
            'bisnis' => [
                'title' => $t('Produk Karet Industri — Resiprene 35 & Aneka Barang Karet', 'Industrial Rubber Products — Resiprene 35 & Rubber Goods'),
                'description' => $t('Lini bisnis PT IKN: Resiprene 35 untuk cat, tinta, dan coating, serta barang karet industri untuk perkebunan dan pabrik. Lihat spesifikasi, harga, dan pesan online.', 'PT IKN business lines: Resiprene 35 for paints, inks and coatings, and industrial rubber goods for plantations and factories. See specifications, prices and order online.'),
            ],
            'keberlanjutan' => [
                'title' => $t('Keberlanjutan, Sertifikasi & Pelanggan PT IKN', 'Sustainability, Certifications & Customers of PT IKN'),
                'description' => $t('Komitmen ESG PT Industri Karet Nusantara: sertifikasi ISO dan REACH, pelanggan industri dalam dan luar negeri, serta saluran Whistle Blowing System.', 'ESG commitment of PT Industri Karet Nusantara: ISO and REACH certifications, domestic and international industrial customers, and the Whistle Blowing System.'),
            ],
            'media' => [
                'title' => $t('Media PT IKN — Berita, Galeri & Unduhan Brosur', 'PT IKN Media — News, Gallery & Brochure Downloads'),
                'description' => $t('Kabar terbaru, galeri foto dan video produksi, serta brosur produk karet PT Industri Karet Nusantara yang dapat diunduh.', 'Latest news, production photo and video gallery, and downloadable rubber product brochures from PT Industri Karet Nusantara.'),
            ],
            'berita' => [
                'title' => $t('Berita & Artikel Industri Karet — PT IKN', 'Rubber Industry News & Articles — PT IKN'),
                'description' => $t('Berita perusahaan, kegiatan, dan artikel seputar industri karet hilir dari PT Industri Karet Nusantara, Medan.', 'Company news, activities and downstream rubber industry articles from PT Industri Karet Nusantara, Medan.'),
            ],
            'galeri' => [
                'title' => $t('Galeri Foto & Video Pabrik Karet PT IKN', 'PT IKN Rubber Plant Photo & Video Gallery'),
                'description' => $t('Dokumentasi foto dan video pabrik, proses produksi, dan kegiatan PT Industri Karet Nusantara.', 'Photos and videos of the plant, production process and activities of PT Industri Karet Nusantara.'),
            ],
            'kontak' => [
                'title' => $t('Kontak PT IKN — Alamat Pabrik, WhatsApp & Penawaran Harga', 'Contact PT IKN — Plant Address, WhatsApp & Price Quotes'),
                'description' => $t('Hubungi PT Industri Karet Nusantara di Jl. Medan–Tanjung Morawa Km 9,5 Medan: telepon, email, WhatsApp marketing, dan formulir permintaan penawaran.', 'Contact PT Industri Karet Nusantara at Jl. Medan–Tanjung Morawa Km 9.5, Medan: phone, email, marketing WhatsApp and quote request form.'),
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

        return [
            'home' => [
                'title' => $t('Beranda', 'Home'),
                'description' => $t('PT Industri Karet Nusantara — hilir karet berkualitas sejak 1965.', 'PT Industri Karet Nusantara — quality downstream rubber since 1965.'),
                'sections' => [
                    ['key' => 'hero', 'type' => 'hero', 'content' => [
                        'meta' => [
                            ['text' => $t('/ Sejak 1965', '/ Since 1965'), 'color' => ''],
                            ['text' => $t('Anak usaha PT Perkebunan Nusantara III', 'Subsidiary of PT Perkebunan Nusantara III'), 'color' => ''],
                            ['text' => $t('Medan, Sumatera Utara', 'Medan, North Sumatra'), 'color' => ''],
                        ],
                        'title' => $t("Menghadirkan\nProduk Karet Berkualitas\nuntuk Industri Global", "Delivering\nQuality Rubber Products\nfor Global Industries"),
                        'subtitle' => $t('PT Industri Karet Nusantara adalah perusahaan mapan yang berspesialisasi dalam produk hilir karet.', 'PT Industri Karet Nusantara is a well-established company specializing in downstream rubber products.'),
                        'buttons' => [
                            ['label' => $t('Lihat produk', 'View products'), 'url' => '/bisnis', 'style' => 'solid', 'profile_document' => false, 'new_tab' => false],
                            ['label' => $t('Profil perusahaan', 'Company profile'), 'url' => '/tentang', 'style' => 'outline', 'profile_document' => true, 'new_tab' => false],
                        ],
                        'slides' => [
                            ['image' => MediaSeeder::id('karet-1-1-scaled.jpg'), 'alt' => $t('Penyadapan getah karet alam', 'Tapping natural rubber latex')],
                            ['image' => MediaSeeder::id('produksi-karet-1.webp'), 'alt' => $t('Proses produksi hilir karet', 'Downstream rubber production process')],
                            ['image' => MediaSeeder::id('pabrik-2-1.png'), 'alt' => $t('Fasilitas pabrik PT IKN', 'PT IKN plant facilities')],
                        ],
                    ]],
                    ['key' => 'marquee', 'type' => 'marquee', 'content' => [
                        'items' => array_map(fn ($w) => ['text' => $w], ['Sarung Egrek Karet', 'Sepatu Boots Karet', 'Resiprene 35', 'Cyclised Natural Rubber', 'Rubber Articles', 'Protective Coatings', 'Marine Paint', 'Sejak 1965', 'Sumatera Utara']),
                    ]],
                    ['key' => 'stats', 'type' => 'stats', 'content' => [
                        'items' => [
                            ['value' => '60', 'unit' => 'Thn', 'label' => $t('Pengalaman sejak 1965', 'Years of experience since 1965')],
                            ['value' => '02', 'unit' => 'Unit', 'label' => $t('Pabrik produksi aktif', 'Active production plants')],
                            ['value' => '100', 'unit' => '%', 'label' => $t('Bahan baku karet lokal', 'Local rubber raw material')],
                            ['value' => 'III', 'unit' => 'PTPN', 'label' => $t('Bagian dari holding', 'Part of the holding')],
                        ],
                    ]],
                    ['key' => 'capabilities', 'type' => 'capabilities', 'content' => [
                        'label' => $t('/ Kenapa IKN', '/ Why IKN'),
                        'heading' => $t('Tiga hal yang membuat produk kami konsisten dari batch ke batch.', 'Three things that keep our products consistent batch after batch.'),
                        'items' => [
                            ['icon' => 'leaf', 'title' => $t('Bahan baku lokal', 'Local raw materials'), 'body' => $t('Karet alam Sumatera Utara diolah menjadi produk hilir bernilai tambah tinggi, dekat dengan sumber kebun.', 'North Sumatra natural rubber processed into high value-added downstream products, close to the plantations.')],
                            ['icon' => 'flask', 'title' => $t('Mutu terkontrol', 'Controlled quality'), 'body' => $t('Setiap tahap produksi melewati kontrol kualitas agar hasil akhir konsisten dan sesuai standar.', 'Every production stage passes quality control so the final result is consistent and to standard.')],
                            ['icon' => 'handshake', 'title' => $t('Kemitraan global', 'Global partnerships'), 'body' => $t('Membangun kerja sama saling menguntungkan dengan pelanggan dan pemangku kepentingan lintas negara.', 'Building mutually beneficial cooperation with customers and stakeholders across countries.')],
                        ],
                    ]],
                    ['key' => 'products', 'type' => 'product_highlights', 'content' => [
                        'label' => $t('/ Lini produk', '/ Product lines'),
                        'heading' => $t('Produk andalan kami.', 'Our flagship products.'),
                        'link_label' => $t('Semua produk', 'All products'),
                        'link_url' => '/bisnis',
                        'items' => [
                            ['code' => 'IKN-PRD-001', 'name' => 'Sarung Egrek', 'kind' => 'Rubber Articles', 'url' => '/bisnis#sarung-egrek', 'summary' => $t('Sarung pelindung pisau egrek kelapa sawit berbahan karet alam berkualitas tinggi untuk keselamatan kerja panen dan perlindungan mata pisau.', 'Protective sheath for oil palm harvesting sickles made of high quality natural rubber, for harvest safety and blade protection.')],
                            ['code' => 'IKN-PRD-002', 'name' => 'Sepatu Boots', 'kind' => 'Rubber Articles', 'url' => '/bisnis#sepatu-boots', 'summary' => $t('Sepatu boots karet industri dan perkebunan standar mutu tinggi dengan logo Rubin PTPN. Tahan air, anti-slip, fleksibel, dan kuat di medan berat.', 'High quality industrial and plantation rubber boots with the Rubin PTPN logo. Waterproof, anti-slip, flexible, and tough on rough terrain.')],
                            ['code' => 'RSP-35', 'name' => 'Resiprene 35', 'kind' => 'Cyclised Natural Rubber', 'url' => '/bisnis#resiprene-35', 'summary' => $t('Karet alam tersiklisasi dalam bentuk padatan kristal amber dengan kelarutan sangat baik pada pelarut tak berbau. Bahan andalan untuk cat pelindung, coating perawatan, dan cat marine.', 'Cyclised natural rubber in amber crystalline solid form with excellent solubility in odourless solvents. A staple for protective paints, maintenance coatings, and marine paints.')],
                        ],
                    ]],
                    ['key' => 'videos', 'type' => 'video_gallery', 'content' => [
                        'label' => $t('/ Galeri video', '/ Video gallery'),
                        'heading' => $t('Lihat proses dan profil kami.', 'See our process and profile.'),
                        'videos' => [
                            ['youtube_id' => 'FGJQW6l2hrk', 'title' => $t('Company Profile — PT Industri Karet Nusantara', 'Company Profile — PT Industri Karet Nusantara'), 'desc' => $t('Gambaran fasilitas produksi, sejarah, visi, misi, dan kontribusi PT IKN dalam rantai pasok hilirisasi karet.', 'An overview of production facilities, history, vision, mission, and PT IKN’s contribution to the downstream rubber supply chain.')],
                            ['youtube_id' => '-CSAwkNrNzY', 'title' => $t('Proses Pengolahan & Mutu Produk Hilir', 'Processing & Quality of Downstream Products'), 'desc' => $t('Liputan pengolahan karet alam menjadi Resiprene 35 dan aneka barang karet bermutu tinggi.', 'Coverage of processing natural rubber into Resiprene 35 and high quality rubber articles.')],
                        ],
                    ]],
                    ['key' => 'cta', 'type' => 'cta', 'content' => [
                        'label' => $t('/ Mari bekerja sama', '/ Let’s work together'),
                        'title' => $t('Punya kebutuhan produk karet? Ceritakan pada kami.', 'Need rubber products? Tell us about it.'),
                        'button_label' => $t('Hubungi kami', 'Contact us'),
                        'button_url' => '/kontak',
                    ]],
                ],
            ],

            'tentang' => [
                'title' => $t('Tentang Kami', 'About Us'),
                'description' => $t('Profil PT Industri Karet Nusantara — sejarah sejak 1965, visi, misi, dan nilai AKHLAK.', 'Profile of PT Industri Karet Nusantara — history since 1965, vision, mission, and AKHLAK values.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => [
                        'label' => $t('/ 01 — Tentang', '/ 01 — About'),
                        'title' => $t('Berpengalaman sejak 1965.', 'Experienced since 1965.'),
                        'lead' => $t('PT Industri Karet Nusantara adalah perusahaan hilir karet yang mapan, anak perusahaan PT Perkebunan Nusantara III, berbasis di Medan, Sumatera Utara.', 'PT Industri Karet Nusantara is an established downstream rubber company, a subsidiary of PT Perkebunan Nusantara III, based in Medan, North Sumatra.'),
                        'media' => self::headerMedia(['kantor-direksi.png', 'pabrik-2-1.png']),
                        'interval' => 6,
                        'layout' => 'split',
                        'breadcrumb' => false,
                    ]],
                    ['key' => 'profile', 'type' => 'text_visual', 'content' => [
                        'label' => $t('/ Profil', '/ Profile'),
                        'heading' => $t('Dari kebun karet Nusantara ke industri hilir.', 'From Nusantara rubber plantations to downstream industry.'),
                        'body' => $t(
                            "Berdiri dan berkembang sejak 1965, IKN mengolah kekayaan karet alam Indonesia menjadi produk hilir bernilai tambah tinggi — mulai dari Resiprene 35 hingga beragam barang karet industri.\n\nSebagai bagian dari PT Perkebunan Nusantara III, kami menjunjung tata kelola perusahaan yang baik serta terus berinovasi mengikuti kebutuhan pasar global.",
                            "Established and growing since 1965, IKN turns Indonesia’s natural rubber into high value-added downstream products — from Resiprene 35 to a range of industrial rubber articles.\n\nAs part of PT Perkebunan Nusantara III, we uphold good corporate governance and keep innovating to meet global market needs."
                        ),
                        'button_label' => $t('', ''), 'button_url' => '',
                        'visual_label' => '/ Est. 1965', 'visual_mark' => 'IKN',
                    ]],
                    ['key' => 'history', 'type' => 'timeline', 'content' => [
                        'label' => $t('/ Perjalanan', '/ Journey'),
                        'heading' => $t('Sejarah perusahaan.', 'Company history.'),
                        'items' => self::historyItems($t),
                    ]],
                    ['key' => 'vision-mission', 'type' => 'vision_mission', 'content' => [
                        'label' => $t('/ Arah perusahaan', '/ Company direction'),
                        'heading' => $t('Visi & Misi.', 'Vision & Mission.'),
                        'vision_tag' => $t('Visi', 'Vision'),
                        'vision' => $t('Menjadi perusahaan hilir karet terdepan yang memenuhi kebutuhan pelanggan melalui tata kelola yang kuat dan daya saing global.', 'To be the leading downstream rubber company that meets customer needs through strong governance and global competitiveness.'),
                        'mission_tag' => $t('Misi', 'Mission'),
                        'missions' => [
                            ['text' => $t('Memproduksi produk hilir karet bermutu tinggi sesuai standar dan harapan pelanggan.', 'Produce high quality downstream rubber products to standards and customer expectations.')],
                            ['text' => $t('Membangun lingkungan kerja terukur dan berorientasi tujuan dengan tata kelola yang baik.', 'Build a measurable, goal-oriented workplace with good governance.')],
                            ['text' => $t('Mengembangkan sumber daya manusia berlandaskan nilai AKHLAK.', 'Develop human resources grounded in the AKHLAK values.')],
                            ['text' => $t('Membangun kemitraan yang saling menguntungkan dengan seluruh pemangku kepentingan.', 'Build mutually beneficial partnerships with all stakeholders.')],
                            ['text' => $t('Memanfaatkan dan mengembangkan teknologi dalam proses bisnis.', 'Use and develop technology in business processes.')],
                        ],
                    ]],
                    self::orgChartSection($t),
                    ['key' => 'values', 'type' => 'values', 'content' => [
                        'label' => $t('/ Nilai inti', '/ Core values'),
                        'heading' => $t('AKHLAK — cara kami bekerja.', 'AKHLAK — how we work.'),
                        'items' => [
                            ['title' => $t('Amanah', 'Amanah (Trust)'), 'body' => $t('Memegang teguh kepercayaan yang diberikan.', 'Holding firmly to the trust given.')],
                            ['title' => $t('Kompeten', 'Kompeten (Competence)'), 'body' => $t('Terus belajar dan mengembangkan kapabilitas.', 'Continuously learning and developing capabilities.')],
                            ['title' => $t('Harmonis', 'Harmonis (Harmony)'), 'body' => $t('Saling peduli dan menghargai perbedaan.', 'Caring for one another and respecting differences.')],
                            ['title' => $t('Loyal', 'Loyal (Loyalty)'), 'body' => $t('Berdedikasi dan mengutamakan kepentingan bersama.', 'Dedicated and putting shared interests first.')],
                            ['title' => $t('Adaptif', 'Adaptif (Adaptability)'), 'body' => $t('Terus berinovasi menghadapi perubahan.', 'Continuously innovating in the face of change.')],
                            ['title' => $t('Kolaboratif', 'Kolaboratif (Collaboration)'), 'body' => $t('Membangun kerja sama yang sinergis.', 'Building synergistic cooperation.')],
                        ],
                    ]],
                ],
            ],

            'kontak' => [
                'title' => $t('Kontak', 'Contact'),
                'description' => $t('Hubungi PT Industri Karet Nusantara — lokasi kantor, pabrik, email, dan media sosial.', 'Contact PT Industri Karet Nusantara — office and plant locations, email, and social media.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => [
                        'label' => $t('/ Kontak', '/ Contact'),
                        'title' => $t('Mari terhubung.', 'Let’s connect.'),
                        'lead' => $t('Punya pertanyaan seputar produk, kemitraan, atau kunjungan pabrik? Tim kami siap membantu.', 'Questions about products, partnerships, or plant visits? Our team is ready to help.'),
                        'media' => self::headerMedia(['kantor-direksi.png']),
                        'interval' => 6,
                        'layout' => 'split',
                        'breadcrumb' => false,
                    ]],
                    ['key' => 'contact-info', 'type' => 'contact_info', 'content' => [
                        'locations' => [
                            // geo = perkiraan titik dari alamat; admin dapat menggeser pin di Pengaturan section.
                            ['name' => $t('Kantor Pusat & Pabrik Barang Karet', 'Head Office & Rubber Articles Plant'), 'address' => 'Jl. Medan – Tanjung Morawa Km 9,5, Medan 20148, Sumatera Utara, Indonesia', 'phones' => [['number' => '+62 61 786 7356'], ['number' => '+62 811 648 0083']], 'geo' => self::GEO_HEAD_OFFICE],
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
                ],
            ],

            'keberlanjutan' => [
                'title' => $t('Keberlanjutan', 'Sustainability'),
                'description' => $t('Komitmen keberlanjutan PT Industri Karet Nusantara — lingkungan, sosial, tata kelola, sertifikat, pelanggan, REACH, dan whistle blowing.', 'PT Industri Karet Nusantara’s sustainability commitment — environment, social, governance, certificates, customers, REACH, and whistle blowing.'),
                'sections' => self::sustainabilitySections($t, $reachUrl),
            ],

            'media' => [
                'title' => $t('Media', 'Media'),
                'description' => $t('Berita, foto, dan video PT Industri Karet Nusantara.', 'News, photos, and videos of PT Industri Karet Nusantara.'),
                'sections' => self::mediaSections($t),
            ],

            'galeri' => [
                'title' => $t('Galeri', 'Gallery'),
                'description' => $t('Galeri foto dan video fasilitas produksi PT Industri Karet Nusantara.', 'Photo and video gallery of PT Industri Karet Nusantara’s production facilities.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ Media — Galeri', '/ Media — Gallery'), 'title' => $t('Galeri foto & video.', 'Photo & video gallery.'), 'lead' => $t('Cuplikan fasilitas produksi, bahan baku, dan proses hilirisasi karet di PT Industri Karet Nusantara.', 'Glimpses of production facilities, raw materials, and downstream rubber processing at PT Industri Karet Nusantara.'), 'breadcrumb' => false]],
                    ['key' => 'gallery', 'type' => 'gallery', 'content' => ['photos_label' => $t('/ Foto', '/ Photos'), 'videos_label' => $t('/ Video', '/ Videos'), 'empty_text' => $t('Belum ada media yang dipublikasikan.', 'No media published yet.')]],
                ],
            ],

            'berita' => [
                'title' => $t('Berita', 'News'),
                'description' => $t('Kabar terbaru dari PT Industri Karet Nusantara — kegiatan, produk, dan perkembangan perusahaan.', 'Latest news from PT Industri Karet Nusantara — activities, products, and company developments.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ Media — Berita', '/ Media — News'), 'title' => $t('Berita perusahaan.', 'Company news.'), 'lead' => $t('Informasi terbaru mengenai perusahaan, produk, kegiatan, dan kemitraan PT Industri Karet Nusantara.', 'The latest on the company, products, activities, and partnerships of PT Industri Karet Nusantara.'), 'breadcrumb' => false]],
                    ['key' => 'list', 'type' => 'news', 'content' => ['empty_text' => $t('Belum ada berita yang dipublikasikan.', 'No news published yet.')]],
                ],
            ],

            // Halaman Bisnis (/bisnis, dulu /produk): lini bisnis, produk dari katalog (dirender rute FE), tautan lanjutan, CTA.
            'bisnis' => [
                'title' => $t('Bisnis', 'Business'),
                'description' => $t('Lini bisnis PT Industri Karet Nusantara — Resiprene 35 (cyclised natural rubber) dan aneka barang karet industri, tersedia di katalog online.', 'PT Industri Karet Nusantara’s business lines — Resiprene 35 (cyclised natural rubber) and industrial rubber articles, available in the online catalog.'),
                'sections' => self::businessSections($t),
            ],
        ];
    }

    /** Section halaman Bisnis; dipakai juga oleh migrasi perapian halaman lewat kelas ini. */
    public static function businessSections(callable $t): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Bisnis', '/ Business'),
                'title' => $t('Hilirisasi karet bernilai tambah.', 'Value-added rubber downstreaming.'),
                'lead' => $t('Dua lini bisnis kami mengolah karet alam Nusantara menjadi bahan baku industri cat serta produk karet siap pakai untuk perkebunan, otomotif, dan infrastruktur.', 'Our two business lines turn Nusantara natural rubber into raw material for the paint industry and ready-to-use rubber products for plantations, automotive, and infrastructure.'),
                'media' => self::headerMedia(['produksi-karet-1.webp', 'karet-1-1-scaled.jpg']),
                'interval' => 6,
                'layout' => 'split',
                'breadcrumb' => false,
            ]],
            ['key' => 'resiprene-35', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Lini bisnis 01 — Resiprene 35', '/ Business line 01 — Resiprene 35'),
                'heading' => $t('Cyclised natural rubber untuk cat dan coating.', 'Cyclised natural rubber for paints and coatings.'),
                'body' => $t(
                    "Resiprene 35 adalah karet alam tersiklisasi berbentuk padatan kristal amber dengan kelarutan sangat baik pada pelarut tak berbau. Bahan andalan untuk cat pelindung, coating perawatan, cat marine, dan tinta cetak.\n\nDiproduksi di pabrik Sei Bamban dengan kontrol mutu laboratorium bersertifikat dan telah memenuhi kepatuhan REACH untuk pasar Eropa.",
                    "Resiprene 35 is cyclised natural rubber in amber crystalline solid form with excellent solubility in odourless solvents. A staple for protective paints, maintenance coatings, marine paints, and printing inks.\n\nProduced at the Sei Bamban plant under certified laboratory quality control and REACH-compliant for the European market."
                ),
                'button_label' => $t('Lihat Resiprene 35 di katalog', 'View Resiprene 35 in the catalog'),
                'button_url' => '/catalog',
                'visual_label' => 'Cyclised Natural Rubber',
                'visual_mark' => 'RSP-35',
            ]],
            ['key' => 'barang-karet', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ Lini bisnis 02 — Aneka barang karet', '/ Business line 02 — Rubber articles'),
                'heading' => $t('Produk karet siap pakai untuk perkebunan dan industri.', 'Ready-to-use rubber products for plantations and industry.'),
                'body' => $t(
                    "Pabrik barang karet di Tanjung Morawa memproduksi sarung egrek, sepatu boots, dan komponen karet teknis lainnya dari karet alam berkualitas tinggi.\n\nSemua produk dibuat sesuai standar mutu PTPN dan dapat dipesan langsung melalui katalog online oleh pelanggan perusahaan.",
                    "The rubber articles plant in Tanjung Morawa produces harvesting sickle sheaths, rubber boots, and other technical rubber components from high quality natural rubber.\n\nEvery product is made to PTPN quality standards and can be ordered directly through the online catalog by business customers."
                ),
                'button_label' => $t('Lihat barang karet di katalog', 'View rubber articles in the catalog'),
                'button_url' => '/catalog',
                // Panel di kiri agar dua lini bisnis berselang-seling (teks kiri, lalu teks kanan).
                'image_side' => 'left',
                'visual_label' => 'Rubber Articles',
                'visual_mark' => 'IKN-PRD',
            ]],
            ['key' => 'links', 'type' => 'link_cards', 'content' => [
                'label' => $t('/ Selanjutnya', '/ Next steps'),
                'heading' => $t('Dari spesifikasi sampai pemesanan.', 'From specifications to ordering.'),
                'lead' => $t('', ''),
                'items' => [
                    ['icon' => 'bag', 'title' => $t('Katalog & pemesanan online', 'Catalog & online ordering'), 'body' => $t('Lihat harga dan stok, lalu pesan langsung sebagai pelanggan perusahaan.', 'See prices and stock, then order directly as a business customer.'), 'url' => '/catalog', 'link_label' => $t('Buka katalog', 'Open catalog')],
                    ['icon' => 'package', 'title' => $t('Brosur & dokumen produk', 'Product brochures & documents'), 'body' => $t('Unduh brosur, lembar data keselamatan, dan spesifikasi teknis.', 'Download brochures, safety data sheets, and technical specifications.'), 'url' => '/bisnis#unduhan', 'link_label' => $t('Ke unduhan', 'Go to downloads')],
                    ['icon' => 'shieldCheck', 'title' => $t('Sertifikat & kepatuhan REACH', 'Certificates & REACH compliance'), 'body' => $t('Standar mutu dan kepatuhan pasar Eropa yang kami pegang.', 'The quality standards and EU market compliance we uphold.'), 'url' => '/keberlanjutan#sertifikat', 'link_label' => $t('Lihat sertifikat', 'View certificates')],
                ],
            ]],
            ['key' => 'unduhan', 'type' => 'brochures', 'content' => [
                'label' => $t('/ Unduhan', '/ Downloads'),
                'heading' => $t('Brosur & dokumen produk.', 'Product brochures & documents.'),
                'empty_text' => $t('Belum ada dokumen yang dipublikasikan.', 'No documents published yet.'),
            ]],
            ['key' => 'cta', 'type' => 'cta', 'content' => ['label' => $t('/ Butuh spesifikasi teknis?', '/ Need technical specifications?'), 'title' => $t('Tim kami bantu memilih grade dan formulasi yang tepat.', 'Our team helps you choose the right grade and formulation.'), 'button_label' => $t('Hubungi kami', 'Contact us'), 'button_url' => '/kontak']],
        ];
    }

    /** Section halaman Keberlanjutan satu halaman (anchor = key); dipakai juga oleh migrasi penggabungan sub-halaman. */
    public static function sustainabilitySections(callable $t, string $reachUrl = '/keberlanjutan#sertifikat'): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Keberlanjutan', '/ Sustainability'),
                'title' => $t('Tumbuh bertanggung jawab.', 'Growing responsibly.'),
                'lead' => $t('PT Industri Karet Nusantara mengelola karet Nusantara dengan memperhatikan keseimbangan lingkungan, sosial, dan tata kelola yang baik.', 'PT Industri Karet Nusantara manages Nusantara rubber with attention to environmental, social, and governance balance.'),
                'media' => self::headerMedia(['karet-1-1-scaled.jpg']),
                'interval' => 6,
                'layout' => 'split',
                'breadcrumb' => false,
            ]],
            ['key' => 'esg', 'type' => 'pillars', 'content' => [
                'label' => $t('/ Lingkungan, Sosial, Tata Kelola', '/ Environment, Social, Governance'),
                'heading' => $t('Tiga pilar keberlanjutan kami.', 'Our three sustainability pillars.'),
                'items' => [
                    ['key' => 'lingkungan', 'icon' => 'leaf', 'title' => $t('Lingkungan', 'Environment'), 'body' => $t('Mengolah karet alam secara bertanggung jawab, menekan limbah proses, dan menjaga efisiensi sumber daya di setiap tahap produksi.', 'Processing natural rubber responsibly, reducing process waste, and keeping resources efficient at every production stage.'), 'points' => [
                        ['text' => $t('Pemanfaatan bahan baku karet lokal Sumatera Utara', 'Use of local North Sumatra rubber raw materials')],
                        ['text' => $t('Pengelolaan limbah produksi yang terkontrol', 'Controlled production waste management')],
                        ['text' => $t('Efisiensi energi pada proses hilir', 'Energy efficiency in downstream processes')],
                    ]],
                    ['key' => 'sosial', 'icon' => 'handshake', 'title' => $t('Sosial', 'Social'), 'body' => $t('Menciptakan dampak positif bagi masyarakat sekitar dan mengembangkan sumber daya manusia berlandaskan nilai AKHLAK.', 'Creating positive impact for surrounding communities and developing people grounded in the AKHLAK values.'), 'points' => [
                        ['text' => $t('Pengembangan SDM berkelanjutan', 'Continuous people development')],
                        ['text' => $t('Kemitraan dengan pekebun dan mitra lokal', 'Partnerships with growers and local partners')],
                        ['text' => $t('Lingkungan kerja yang sehat dan aman', 'A healthy and safe workplace')],
                    ]],
                    ['key' => 'tata-kelola', 'icon' => 'gear', 'title' => $t('Tata Kelola', 'Governance'), 'body' => $t('Menjalankan Good Corporate Governance sebagai anak perusahaan PTPN III dengan transparansi dan akuntabilitas.', 'Practising Good Corporate Governance as a PTPN III subsidiary with transparency and accountability.'), 'points' => [
                        ['text' => $t('Prinsip Good Corporate Governance (GCG)', 'Good Corporate Governance (GCG) principles')],
                        ['text' => $t('Transparansi dan akuntabilitas', 'Transparency and accountability')],
                        ['text' => $t('Kepatuhan terhadap standar induk usaha', 'Compliance with the parent company’s standards')],
                    ]],
                ],
            ]],
            ['key' => 'sertifikat', 'type' => 'certificates', 'content' => [
                'label' => $t('/ Sertifikat', '/ Certificates'),
                'heading' => $t('Standar yang kami pegang.', 'The standards we uphold.'),
                'empty_text' => $t('Belum ada sertifikat yang dipublikasikan.', 'No certificates published yet.'),
            ]],
            ['key' => 'pelanggan', 'type' => 'customer_logos', 'content' => [
                'label' => $t('/ Pelanggan Kami', '/ Our Customers'),
                'heading' => $t('Dipercaya lintas industri.', 'Trusted across industries.'),
                'lead' => $t('Produk Resiprene 35 dan barang karet kami digunakan oleh mitra di industri coating, marine, semen, dan kelapa sawit — di dalam maupun luar negeri.', 'Our Resiprene 35 and rubber articles are used by partners in the coating, marine, cement, and palm oil industries — at home and abroad.'),
            ]],
            ['key' => 'reach', 'type' => 'text_visual', 'content' => [
                'label' => $t('/ REACH Compliance', '/ REACH Compliance'),
                'heading' => $t('Terdaftar REACH untuk ekspor ke Uni Eropa.', 'REACH-registered for export to the European Union.'),
                'body' => $t(
                    "REACH (Registration, Evaluation, Authorisation and Restriction of Chemicals) adalah regulasi Uni Eropa untuk memastikan keamanan bahan kimia. Produk Resiprene PT Industri Karet Nusantara telah memenuhi persyaratan registrasi REACH.\n\nKepatuhan ini memperkuat posisi produk kami di pasar ekspor Eropa, khususnya untuk aplikasi coating dan cat marine.",
                    "REACH (Registration, Evaluation, Authorisation and Restriction of Chemicals) is the European Union regulation that ensures the safety of chemicals. PT Industri Karet Nusantara’s Resiprene products meet the REACH registration requirements.\n\nThis compliance strengthens our position in European export markets, especially for coating and marine paint applications."
                ),
                'button_label' => $t('Sertifikat REACH', 'REACH certificate'),
                'button_url' => $reachUrl,
                'visual_label' => '/ EU REACH',
                'visual_mark' => 'REACH',
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

    /** Section halaman hub Media (/media): header + kartu ke Berita dan Galeri; teaser berita/foto dirender rute FE. */
    public static function mediaSections(callable $t): array
    {
        return [
            ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t('/ Media', '/ Media'),
                'title' => $t('Kabar, foto, dan video.', 'News, photos, and videos.'),
                'lead' => $t('Ikuti perkembangan PT Industri Karet Nusantara lewat berita perusahaan serta dokumentasi foto dan video dari pabrik dan kegiatan kami.', 'Follow PT Industri Karet Nusantara through company news and photo and video documentation from our plants and activities.'),
                'media' => self::headerMedia(['pabrik-2-1.png']),
                'interval' => 6,
                'layout' => 'split',
                'breadcrumb' => false,
            ]],
            ['key' => 'links', 'type' => 'link_cards', 'content' => [
                'label' => $t('/ Jelajahi', '/ Explore'),
                'heading' => $t('Pilih yang ingin Anda lihat.', 'Choose what to see.'),
                'lead' => $t('', ''),
                'items' => [
                    ['icon' => 'quote', 'title' => $t('Berita', 'News'), 'body' => $t('Berita perusahaan, produk, kegiatan, dan kemitraan, lengkap dengan filter kategori.', 'Company, product, activity, and partnership news with category filters.'), 'url' => '/berita', 'link_label' => $t('Buka berita', 'Open news')],
                    ['icon' => 'image', 'title' => $t('Galeri', 'Gallery'), 'body' => $t('Foto fasilitas produksi dan video profil perusahaan.', 'Photos of production facilities and company profile videos.'), 'url' => '/galeri', 'link_label' => $t('Buka galeri', 'Open gallery')],
                ],
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
                'name' => $t('Pabrik Ban Sepeda TAVIP (DATAK Sumatera Utara)', 'TAVIP Bicycle Tyre Factory (DATAK North Sumatra)'),
                'title' => $t('1965–1968', '1965–1968'),
                'body' => $t('Sejak didirikan, pengelolaannya oleh DATAK (Dana Tanaman Keras) Sumatera Utara dengan nama Pabrik Ban Sepeda TAVIP.', 'Since its founding, managed by DATAK (Dana Tanaman Keras) North Sumatra under the name TAVIP Bicycle Tyre Factory.'),
                'products' => $t('Ban sepeda luar dan dalam', 'Bicycle tyres and inner tubes'),
            ],
            [
                'year' => '1968',
                'name' => $t('Industri Karet TAFIKA (PTP-II)', 'TAFIKA Rubber Industry (PTP-II)'),
                'title' => $t('1968–1971', '1968–1971'),
                'body' => $t('Sesuai Surat Keputusan Menteri Pertanian No. 175/KPTS/OP/8/1968, pengelolaannya beralih ke PT Perkebunan II dengan nama Industri Karet Tafika.', 'Under Minister of Agriculture Decree No. 175/KPTS/OP/8/1968, management passed to PT Perkebunan II under the name Tafika Rubber Industry.'),
                'products' => $t('Ban sepeda dan karet gelang', 'Bicycle tyres and rubber bands'),
            ],
            [
                'year' => '1971',
                'name' => $t('KPB/PNP/PTP I–IX Sumut Aceh', 'KPB/PNP/PTP I–IX North Sumatra & Aceh'),
                'title' => $t('1971–1978', '1971–1978'),
                'body' => $t('Dengan Surat Keputusan Perwakilan B.C.U/PTP Wilayah I No. 24/49/1971 pengelolaan dialihkan kepada PT Perkebunan III; sesuai Surat Keputusan Dirjen Perkebunan No. 76/BCU.KPB/KPTS/1971 pengelolaannya beralih ke KPB/PNP/PTP I–IX Sumut Aceh.', 'By B.C.U/PTP Region I Representative Decree No. 24/49/1971 management moved to PT Perkebunan III; under Directorate General of Plantations Decree No. 76/BCU.KPB/KPTS/1971 it passed to KPB/PNP/PTP I–IX North Sumatra & Aceh.'),
                'products' => $t('Rubber articles, karet gelang, dan ban sepeda', 'Rubber articles, rubber bands and bicycle tyres'),
            ],
            [
                'year' => '1978',
                'name' => $t('Unit Kerja PT Perkebunan III', 'Business Unit of PT Perkebunan III'),
                'title' => $t('1978–1982', '1978–1982'),
                'body' => $t('Sesuai Surat Keputusan Menteri Pertanian No. 12/KPTS/UM/I/1978 pengelolaannya dialihkan kepada PT Perkebunan III.', 'Under Minister of Agriculture Decree No. 12/KPTS/UM/I/1978 management was transferred to PT Perkebunan III.'),
                'products' => $t('Rubber articles, karet gelang, dan compound', 'Rubber articles, rubber bands and compound'),
            ],
            [
                'year' => '1982',
                'name' => $t('Proyek Industri Karet PT Perkebunan III', 'Rubber Industry Project of PT Perkebunan III'),
                'title' => $t('1982–1989', '1982–1989'),
                'body' => $t('Peralihan nama menjadi Proyek Industri Karet PT Perkebunan III.', 'Renamed the Rubber Industry Project of PT Perkebunan III.'),
                'products' => $t('Rubber articles, karet gelang, compound, conveyor belt, dock fender, dan sarung tangan', 'Rubber articles, rubber bands, compound, conveyor belts, dock fenders and gloves'),
            ],
            [
                'year' => '1996',
                'name' => $t('Unit Kerja PT Perkebunan Nusantara III', 'Business Unit of PT Perkebunan Nusantara III'),
                'title' => $t('1996–2006', '1996–2006'),
                'body' => $t("Sesuai PP No. 8/1996 tanggal 14 Februari 1996, PT Perkebunan III, IV, dan V dilebur menjadi PT Perkebunan Nusantara III dan Pabrik Industri Karet menjadi salah satu unit kerjanya.\n\n2003–2004, berdasarkan SKPTS Direksi No. III.10/SKPTS/R/07.A/2003 tanggal 27 Januari 2003, usaha Pabrik Sarung Tangan dan Pabrik Karet Gelang tidak dioperasikan.\n\n2005–2006, berdasarkan SKPTS Direksi No. 3.08/SKPTS/01/2005 tanggal 10 Januari 2005, nama Pabrik Industri Karet PTPN III diubah menjadi Pabrik Rubber Thread dan Rubber Articles (PRTRA).", "Under Government Regulation No. 8/1996 of 14 February 1996, PT Perkebunan III, IV and V merged into PT Perkebunan Nusantara III and the Rubber Industry Plant became one of its business units.\n\nIn 2003–2004, by Board Decree No. III.10/SKPTS/R/07.A/2003 of 27 January 2003, the glove and rubber band plants were taken out of operation.\n\nIn 2005–2006, by Board Decree No. 3.08/SKPTS/01/2005 of 10 January 2005, the PTPN III Rubber Industry Plant was renamed the Rubber Thread and Rubber Articles Plant (PRTRA)."),
                'products' => $t('Rubber articles, conveyor belt, dock fender, sarung tangan, benang karet, dan karet gelang', 'Rubber articles, conveyor belts, dock fenders, gloves, rubber thread and rubber bands'),
            ],
            [
                'year' => $t('2006 s.d. Sekarang', '2006 – present')['id'],
                'name' => $t('PT Industri Karet Nusantara — Anak Perusahaan PT Perkebunan Nusantara III (Persero)', 'PT Industri Karet Nusantara — Subsidiary of PT Perkebunan Nusantara III (Persero)'),
                'title' => $t('Sejak 4 April 2006', 'Since 4 April 2006'),
                'body' => $t("Berdasarkan Akta Pendirian No. 4 Tahun 2006 oleh Notaris Syafnil Gani, SH, M.Hum, menjadi PT Industri Karet Nusantara, anak perusahaan PT Perkebunan Nusantara III (Persero).\n\nBerdasarkan keputusan RUPS RKAP 2017, Pabrik Rubber Thread dihentikan operasionalnya.", "By Deed of Establishment No. 4 of 2006 before Notary Syafnil Gani, SH, M.Hum, it became PT Industri Karet Nusantara, a subsidiary of PT Perkebunan Nusantara III (Persero).\n\nBy resolution of the 2017 RKAP shareholders' meeting, the Rubber Thread plant ceased operation."),
                'products' => $t('Rubber articles dan Resiprene', 'Rubber articles and Resiprene'),
            ],
        ];
    }

    public static function orgChartSection(callable $t): array
    {
        $levels = self::orgChartLevels();
        $n = fn (string $key, string $parent, string $id, ?string $en = null) => [
            'key' => $key, 'parent' => $parent, 'title' => $t($id, $en ?? $id), 'holder' => '', 'level' => $levels[$key] ?? 'pelaksana',
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
