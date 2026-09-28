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

    public function run()
    {
        foreach ($this->pages() as $slug => $page) {
            $model = Page::firstOrCreate(['slug' => $slug], [
                'title' => $page['title'],
                'status' => Page::STATUS_PUBLISHED,
                'seo' => ['title' => $page['title'], 'description' => $page['description'] ?? ['id' => '', 'en' => '']],
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
        $reachUrl = $reach?->targetUrl() ?: '/keberlanjutan/sertifikat';

        return [
            'home' => [
                'title' => $t('Beranda', 'Home'),
                'description' => $t('PT Industri Karet Nusantara — hilir karet berkualitas sejak 1965.', 'PT Industri Karet Nusantara — quality downstream rubber since 1965.'),
                'sections' => [
                    ['key' => 'hero', 'type' => 'hero', 'content' => [
                        'meta' => [
                            ['text' => $t('/ Sejak 1965', '/ Since 1965'), 'color' => '#8fd1a6'],
                            ['text' => $t('Anak usaha PT Perkebunan Nusantara III', 'Subsidiary of PT Perkebunan Nusantara III'), 'color' => ''],
                            ['text' => $t('Medan, Sumatera Utara', 'Medan, North Sumatra'), 'color' => ''],
                        ],
                        'title' => $t("Menghadirkan\nProduk Karet Berkualitas\nuntuk Industri Global", "Delivering\nQuality Rubber Products\nfor Global Industries"),
                        'subtitle' => $t('PT Industri Karet Nusantara adalah perusahaan mapan yang berspesialisasi dalam produk hilir karet.', 'PT Industri Karet Nusantara is a well-established company specializing in downstream rubber products.'),
                        'buttons' => [
                            ['label' => $t('Lihat produk', 'View products'), 'url' => '/produk', 'style' => 'solid', 'profile_document' => false, 'new_tab' => false],
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
                        'link_url' => '/produk',
                        'items' => [
                            ['code' => 'IKN-PRD-001', 'name' => 'Sarung Egrek', 'kind' => 'Rubber Articles', 'url' => '/produk#sarung-egrek', 'summary' => $t('Sarung pelindung pisau egrek kelapa sawit berbahan karet alam berkualitas tinggi untuk keselamatan kerja panen dan perlindungan mata pisau.', 'Protective sheath for oil palm harvesting sickles made of high quality natural rubber, for harvest safety and blade protection.')],
                            ['code' => 'IKN-PRD-002', 'name' => 'Sepatu Boots', 'kind' => 'Rubber Articles', 'url' => '/produk#sepatu-boots', 'summary' => $t('Sepatu boots karet industri dan perkebunan standar mutu tinggi dengan logo Rubin PTPN. Tahan air, anti-slip, fleksibel, dan kuat di medan berat.', 'High quality industrial and plantation rubber boots with the Rubin PTPN logo. Waterproof, anti-slip, flexible, and tough on rough terrain.')],
                            ['code' => 'RSP-35', 'name' => 'Resiprene 35', 'kind' => 'Cyclised Natural Rubber', 'url' => '/produk#resiprene-35', 'summary' => $t('Karet alam tersiklisasi dalam bentuk padatan kristal amber dengan kelarutan sangat baik pada pelarut tak berbau. Bahan andalan untuk cat pelindung, coating perawatan, dan cat marine.', 'Cyclised natural rubber in amber crystalline solid form with excellent solubility in odourless solvents. A staple for protective paints, maintenance coatings, and marine paints.')],
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
                        'heading' => $t('Jejak singkat.', 'A brief history.'),
                        'items' => [
                            ['year' => '1965', 'title' => $t('Titik awal', 'The beginning'), 'body' => $t('Perusahaan mulai beroperasi di bidang pengolahan karet.', 'The company begins operating in rubber processing.')],
                            ['year' => '—', 'title' => $t('Bergabung PTPN III', 'Joining PTPN III'), 'body' => $t('Menjadi anak perusahaan PT Perkebunan Nusantara III.', 'Becomes a subsidiary of PT Perkebunan Nusantara III.')],
                            ['year' => 'Kini', 'title' => $t('Hilir karet mapan', 'An established downstream player'), 'body' => $t('Memproduksi Resiprene 35 dan aneka barang karet dari dua pabrik.', 'Producing Resiprene 35 and rubber articles from two plants.')],
                        ],
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
                        'label' => $t('/ 04 — Kontak', '/ 04 — Contact'),
                        'title' => $t('Mari terhubung.', 'Let’s connect.'),
                        'lead' => $t('Punya pertanyaan seputar produk, kemitraan, atau kunjungan pabrik? Tim kami siap membantu.', 'Questions about products, partnerships, or plant visits? Our team is ready to help.'),
                        'breadcrumb' => false,
                    ]],
                    ['key' => 'contact-info', 'type' => 'contact_info', 'content' => [
                        'locations' => [
                            ['name' => $t('Kantor Pusat & Pabrik Barang Karet', 'Head Office & Rubber Articles Plant'), 'address' => 'Jl. Medan – Tanjung Morawa Km 9,5, Medan 20148, Sumatera Utara, Indonesia', 'phones' => [['number' => '+62 61 786 7356'], ['number' => '+62 811 648 0083']]],
                            ['name' => $t('Pabrik Resiprene', 'Resiprene Plant'), 'address' => 'Sei Bamban Estate, Kec. Sei Bamban, Kab. Serdang Bedagai 20695, Sumatera Utara, Indonesia', 'phones' => []],
                        ],
                        'emails' => [['address' => 'ikn@ptikn.com'], ['address' => 'gpihk_prpne@ikn.co.id']],
                        'social' => [
                            ['label' => 'Instagram', 'handle' => '@ikn.rubber', 'url' => 'https://instagram.com/ikn.rubber'],
                            ['label' => 'YouTube', 'handle' => '@RubberIkn', 'url' => 'https://youtube.com/@RubberIkn'],
                            ['label' => 'TikTok', 'handle' => '@iknrubber', 'url' => 'https://tiktok.com/@iknrubber'],
                        ],
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
                'description' => $t('Komitmen keberlanjutan PT Industri Karet Nusantara — lingkungan, sosial, dan tata kelola.', 'PT Industri Karet Nusantara’s sustainability commitment — environment, social, and governance.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => [
                        'label' => $t('/ 05 — Keberlanjutan', '/ 05 — Sustainability'),
                        'title' => $t('Tumbuh bertanggung jawab.', 'Growing responsibly.'),
                        'lead' => $t('PT Industri Karet Nusantara mengelola karet Nusantara dengan memperhatikan keseimbangan lingkungan, sosial, dan tata kelola yang baik.', 'PT Industri Karet Nusantara manages Nusantara rubber with attention to environmental, social, and governance balance.'),
                        'breadcrumb' => false,
                    ]],
                    ['key' => 'pillars', 'type' => 'pillars', 'content' => [
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
                ],
            ],

            'sertifikat' => [
                'title' => $t('Sertifikat', 'Certificates'),
                'description' => $t('Sertifikasi dan kepatuhan PT Industri Karet Nusantara, termasuk ISO 37001:2016 dan REACH.', 'Certifications and compliance of PT Industri Karet Nusantara, including ISO 37001:2016 and REACH.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ Sertifikat', '/ Certificates'), 'title' => $t('Standar yang kami pegang.', 'The standards we uphold.'), 'lead' => $t('', ''), 'breadcrumb' => true]],
                    ['key' => 'list', 'type' => 'certificates', 'content' => ['empty_text' => $t('Belum ada sertifikat yang dipublikasikan.', 'No certificates published yet.')]],
                ],
            ],

            'pelanggan' => [
                'title' => $t('Pelanggan Kami', 'Our Customers'),
                'description' => $t('Mitra dan pelanggan PT Industri Karet Nusantara di dalam dan luar negeri.', 'Partners and customers of PT Industri Karet Nusantara at home and abroad.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ Pelanggan Kami', '/ Our Customers'), 'title' => $t('Dipercaya lintas industri.', 'Trusted across industries.'), 'lead' => $t('', ''), 'breadcrumb' => true]],
                    ['key' => 'logos', 'type' => 'customer_logos', 'content' => ['lead' => $t('Produk Resiprene 35 dan barang karet kami digunakan oleh mitra di industri coating, marine, semen, dan kelapa sawit — di dalam maupun luar negeri.', 'Our Resiprene 35 and rubber articles are used by partners in the coating, marine, cement, and palm oil industries — at home and abroad.')]],
                ],
            ],

            'reach' => [
                'title' => $t('REACH Compliance', 'REACH Compliance'),
                'description' => $t('Kepatuhan produk PT Industri Karet Nusantara terhadap regulasi REACH Uni Eropa.', 'PT Industri Karet Nusantara product compliance with the EU REACH regulation.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ REACH Compliance', '/ REACH Compliance'), 'title' => $t('Aman untuk pasar Eropa.', 'Safe for the European market.'), 'lead' => $t('', ''), 'breadcrumb' => true]],
                    ['key' => 'summary', 'type' => 'text_visual', 'content' => [
                        'label' => $t('/ Ringkasan', '/ Summary'),
                        'heading' => $t('Terdaftar REACH untuk ekspor ke Uni Eropa.', 'REACH-registered for export to the European Union.'),
                        'body' => $t(
                            "REACH (Registration, Evaluation, Authorisation and Restriction of Chemicals) adalah regulasi Uni Eropa untuk memastikan keamanan bahan kimia. Produk Resiprene PT Industri Karet Nusantara telah memenuhi persyaratan registrasi REACH.\n\nKepatuhan ini memperkuat posisi produk kami di pasar ekspor Eropa, khususnya untuk aplikasi coating dan cat marine.",
                            "REACH (Registration, Evaluation, Authorisation and Restriction of Chemicals) is the European Union regulation that ensures the safety of chemicals. PT Industri Karet Nusantara’s Resiprene products meet the REACH registration requirements.\n\nThis compliance strengthens our position in European export markets, especially for coating and marine paint applications."
                        ),
                        'button_label' => $t('Sertifikat REACH', 'REACH certificate'),
                        'button_url' => $reachUrl,
                        'visual_label' => '/ EU REACH', 'visual_mark' => 'REACH',
                    ]],
                ],
            ],

            'whistleblowing' => [
                'title' => $t('Whistle Blowing System', 'Whistle Blowing System'),
                'description' => $t('Kanal pelaporan dugaan pelanggaran di lingkungan PT Industri Karet Nusantara.', 'Channel for reporting suspected misconduct at PT Industri Karet Nusantara.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ Whistle Blowing System', '/ Whistle Blowing System'), 'title' => $t('Laporkan dugaan pelanggaran.', 'Report suspected misconduct.'), 'lead' => $t('Identitas pelapor dijaga kerahasiaannya sesuai kebijakan perusahaan.', 'The reporter’s identity is kept confidential in line with company policy.'), 'breadcrumb' => true]],
                    ['key' => 'info', 'type' => 'info_blocks', 'content' => ['blocks' => [
                        ['label' => $t('/ Tentang WBS', '/ About the WBS'), 'body' => $t('Whistle Blowing System (WBS) adalah kanal pelaporan dugaan pelanggaran di lingkungan PT Industri Karet Nusantara. Identitas pelapor dijaga kerahasiaannya sesuai kebijakan perusahaan.', 'The Whistle Blowing System (WBS) is the channel for reporting suspected misconduct at PT Industri Karet Nusantara. The reporter’s identity is kept confidential in line with company policy.'), 'points' => []],
                        ['label' => $t('/ Yang dapat dilaporkan', '/ What can be reported'), 'body' => $t('', ''), 'points' => [
                            ['text' => $t('Korupsi, suap, atau gratifikasi', 'Corruption, bribery, or gratuities')],
                            ['text' => $t('Benturan kepentingan', 'Conflicts of interest')],
                            ['text' => $t('Pelanggaran prosedur & keselamatan', 'Procedure and safety violations')],
                            ['text' => $t('Penyalahgunaan wewenang', 'Abuse of authority')],
                        ]],
                    ]]],
                    ['key' => 'form', 'type' => 'wbs_form', 'content' => [
                        'label' => $t('/ Kirim laporan', '/ Submit a report'),
                        'success_title' => $t('Laporan tercatat.', 'Report recorded.'),
                        'success_body' => $t('Simpan kode ini untuk menanyakan tindak lanjut laporan. Laporan Anda akan ditinjau tim terkait secara rahasia.', 'Keep this code to follow up on your report. Your report will be reviewed confidentially by the relevant team.'),
                    ]],
                ],
            ],

            'galeri' => [
                'title' => $t('Galeri', 'Gallery'),
                'description' => $t('Galeri foto dan video fasilitas produksi PT Industri Karet Nusantara.', 'Photo and video gallery of PT Industri Karet Nusantara’s production facilities.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ Media — Galeri', '/ Media — Gallery'), 'title' => $t('Dari dekat.', 'Up close.'), 'lead' => $t('Cuplikan fasilitas produksi, bahan baku, dan proses hilirisasi karet di PT Industri Karet Nusantara.', 'Glimpses of production facilities, raw materials, and downstream rubber processing at PT Industri Karet Nusantara.'), 'breadcrumb' => false]],
                    ['key' => 'gallery', 'type' => 'gallery', 'content' => ['photos_label' => $t('/ Foto', '/ Photos'), 'videos_label' => $t('/ Video', '/ Videos'), 'empty_text' => $t('Belum ada media yang dipublikasikan.', 'No media published yet.')]],
                ],
            ],

            'berita' => [
                'title' => $t('Berita', 'News'),
                'description' => $t('Kabar terbaru dari PT Industri Karet Nusantara — kegiatan, produk, dan perkembangan perusahaan.', 'Latest news from PT Industri Karet Nusantara — activities, products, and company developments.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ 03 — Berita', '/ 03 — News'), 'title' => $t('Kabar terbaru.', 'Latest news.'), 'lead' => $t('Ikuti kegiatan, rilis produk, dan perkembangan terkini PT Industri Karet Nusantara.', 'Follow the activities, product releases, and latest developments of PT Industri Karet Nusantara.'), 'breadcrumb' => false]],
                    ['key' => 'list', 'type' => 'news', 'content' => ['empty_text' => $t('Belum ada berita yang dipublikasikan.', 'No news published yet.')]],
                ],
            ],

            'unduhan' => [
                'title' => $t('Unduhan', 'Downloads'),
                'description' => $t('Brosur produk dan dokumen PT Industri Karet Nusantara.', 'Product brochures and documents of PT Industri Karet Nusantara.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ Unduhan', '/ Downloads'), 'title' => $t('Brosur & dokumen.', 'Brochures & documents.'), 'lead' => $t('', ''), 'breadcrumb' => true]],
                    ['key' => 'list', 'type' => 'brochures', 'content' => ['empty_text' => $t('Belum ada dokumen yang dipublikasikan.', 'No documents published yet.')]],
                ],
            ],

            'produk' => [
                'title' => $t('Produk', 'Products'),
                'description' => $t('Produk hilir karet PT Industri Karet Nusantara — Resiprene 35 dan aneka barang karet industri.', 'Downstream rubber products of PT Industri Karet Nusantara — Resiprene 35 and industrial rubber articles.'),
                'sections' => [
                    ['key' => 'header', 'type' => 'page_header', 'content' => ['label' => $t('/ 02 — Produk', '/ 02 — Products'), 'title' => $t('Karet hilir bernilai tambah.', 'Value-added downstream rubber.'), 'lead' => $t('Dari karet alam Nusantara, kami menghadirkan produk hilir siap pakai untuk industri cat, otomotif, dan infrastruktur.', 'From Nusantara natural rubber, we deliver ready-to-use downstream products for the paint, automotive, and infrastructure industries.'), 'breadcrumb' => false]],
                    ['key' => 'cta', 'type' => 'cta', 'content' => ['label' => $t('/ Butuh spesifikasi teknis?', '/ Need technical specifications?'), 'title' => $t('Tim kami bantu memilih grade dan formulasi yang tepat.', 'Our team helps you choose the right grade and formulation.'), 'button_label' => $t('Hubungi kami', 'Contact us'), 'button_url' => '/kontak']],
                ],
            ],
        ];
    }
}
