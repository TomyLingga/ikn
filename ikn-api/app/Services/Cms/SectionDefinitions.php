<?php

namespace App\Services\Cms;

/**
 * Definisi skema tiap tipe section. Nama field mengikuti section yang ADA di mockup
 * ikn-fe (KEPUTUSAN: admin tidak bisa merusak desain). Menambah tipe = tambah entri di sini
 * plus renderer di ikn-fe/components/cms/sections (dan kelompoknya di GROUP_OF).
 * `pages` hanya petunjuk halaman bawaan untuk pemilih tipe; semua tipe boleh dipakai di halaman mana pun
 * (data daftar diambil FE lewat lib/section-data.ts menurut tipe yang ada di halaman).
 */
final class SectionDefinitions
{
    private static function f(string $type, string $id, string $en, array $extra = []): array
    {
        return array_merge(['type' => $type, 'name' => ['id' => $id, 'en' => $en]], $extra);
    }

    /** Tingkat jabatan bagan organisasi (kunci dipakai FE untuk warna/legenda; label dua bahasa ada di OrgChartSection). */
    public const ORG_LEVELS = [
        'rups' => 'RUPS / Pemegang Saham',
        'komisaris' => 'Dewan Komisaris',
        'direksi' => 'Direksi',
        'sevp' => 'SEVP',
        'bagian' => 'Bagian',
        'sub' => 'Sub Bagian',
        'asisten' => 'Asisten',
        'mandor' => 'Krani 1 / Mandor',
        'pelaksana' => 'Pelaksana',
    ];

    /** Kelompok tipe untuk pemilih "Tambah section" di admin (urutan = urutan tampil). */
    public const GROUPS = [
        'header' => ['id' => 'Pembuka halaman', 'en' => 'Page openers'],
        'content' => ['id' => 'Teks & informasi', 'en' => 'Text & information'],
        'showcase' => ['id' => 'Kartu, foto & video', 'en' => 'Cards, photos & video'],
        'data' => ['id' => 'Daftar dari menu admin', 'en' => 'Lists from admin menus'],
        'contact' => ['id' => 'Kontak & formulir', 'en' => 'Contact & forms'],
    ];

    /** Tipe => kelompok; tipe yang tidak terdaftar masuk 'content'. */
    private const GROUP_OF = [
        'page_header' => 'header', 'hero' => 'header', 'marquee' => 'header',
        'product_highlights' => 'showcase', 'link_cards' => 'showcase', 'cta' => 'showcase', 'team' => 'showcase',
        'testimonials' => 'showcase', 'image_grid' => 'showcase', 'video_gallery' => 'showcase',
        'news' => 'data', 'latest_news' => 'data', 'gallery' => 'data', 'certificates' => 'data', 'brochures' => 'data', 'customer_logos' => 'data',
        'contact_info' => 'contact', 'contact_form' => 'contact', 'contact_summary' => 'contact', 'wbs_form' => 'contact',
    ];

    private static function list(string $id, string $en, array $fields, array $extra = []): array
    {
        return self::f('list', $id, $en, array_merge(['fields' => $fields], $extra));
    }

    private static function type(string $id, string $en, string $descId, string $descEn, array $fields, array $pages = []): array
    {
        return [
            'name' => ['id' => $id, 'en' => $en],
            'description' => ['id' => $descId, 'en' => $descEn],
            'pages' => $pages,
            'fields' => $fields,
        ];
    }

    private static function labelHeading(): array
    {
        return [
            'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
            'heading' => self::f('i18n_text', 'Judul bagian', 'Section heading'),
        ];
    }

    private static function i18nList(string $id, string $en): array
    {
        return self::list($id, $en, ['text' => self::f('i18n_text', 'Teks', 'Text', ['required' => true])]);
    }

    /** Pilihan "Tampilan blok" yang ditambahkan ke setiap tipe section (kosong = plain). */
    public const SURFACES = ['plain' => 'Polos', 'card' => 'Kartu timbul', 'band' => 'Pita berwarna'];

    /** Tipe yang selebar layar atau punya latar sendiri: tidak mendapat pilihan tampilan blok. */
    public const NO_SURFACE = ['page_header', 'hero', 'marquee', 'cta', 'contact_info'];

    public static function all(): array
    {
        $types = self::definitions();
        foreach ($types as $key => $definition) {
            $types[$key]['group'] = self::GROUP_OF[$key] ?? 'content';
            if (! in_array($key, self::NO_SURFACE, true)) {
                $types[$key]['fields']['surface'] = self::f('select', 'Tampilan blok', 'Block style', ['options' => self::SURFACES, 'default' => 'plain']);
            }
        }

        return $types;
    }

    private static function definitions(): array
    {
        return [
            'page_header' => self::type('Kepala halaman', 'Page header',
                'Label, judul besar, paragraf pembuka, dan foto/video (slideshow fade; video berjalan sepanjang durasinya) di atas halaman.',
                'Eyebrow label, display title, lead paragraph, and photos/videos (fade slideshow; a video runs for its own length) at the top of a page.', [
                    'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
                    'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                    'lead' => self::f('i18n_textarea', 'Paragraf pembuka', 'Lead paragraph'),
                    'breadcrumb' => self::f('boolean', 'Tampilkan breadcrumb', 'Show breadcrumb'),
                    // Tanpa media = tata letak teks saja (lama). Media: gambar (jpg/png/webp) atau video MP4/WebM dari media library.
                    'layout' => self::f('select', 'Tata letak media', 'Media layout', ['options' => ['split' => 'Teks kiri, media kanan', 'split_reverse' => 'Media kiri, teks kanan', 'cover' => 'Media memenuhi latar'], 'default' => 'split']),
                    'media' => self::list('Foto / video', 'Photos / videos', [
                        'file' => self::f('media', 'Berkas (gambar atau video MP4/WebM)', 'File (image or MP4/WebM video)', ['required' => true, 'accept' => 'visual']),
                        'caption' => self::f('i18n_text', 'Keterangan (opsional)', 'Caption (optional)', ['max' => 120]),
                    ], ['max_items' => 10]),
                    'interval' => self::f('number', 'Detik per foto (video mengikuti durasinya)', 'Seconds per photo (videos run for their length)'),
                ]),

            'hero' => self::type('Hero beranda', 'Home hero',
                'Slider foto latar, label meta (warna bebas), judul, subjudul, dan tombol (0-3, opsional).',
                'Background photo slider, meta labels (any colour), title, subtitle, and optional buttons (0-3).', [
                    'meta' => self::list('Label meta', 'Meta labels', [
                        'text' => self::f('i18n_text', 'Teks', 'Text', ['required' => true]),
                        'color' => self::f('color', 'Warna teks', 'Text colour'),
                    ]),
                    'title' => self::f('i18n_textarea', 'Judul (satu baris per baris judul)', 'Title (one line per title row)', ['required' => true]),
                    'subtitle' => self::f('i18n_textarea', 'Subjudul', 'Subtitle'),
                    'buttons' => self::list('Tombol', 'Buttons', [
                        'label' => self::f('i18n_text', 'Label', 'Label', ['required' => true, 'max' => 60]),
                        'url' => self::f('url', 'Tautan', 'URL'),
                        'style' => self::f('select', 'Gaya', 'Style', ['options' => ['solid' => 'Utama (isi penuh)', 'outline' => 'Garis (outline)'], 'default' => 'solid']),
                        'profile_document' => self::f('boolean', 'Buka dokumen profil perusahaan (dari Pengaturan Situs) bila tersedia', 'Open the company profile document (Site Settings) when available'),
                        'new_tab' => self::f('boolean', 'Buka di tab baru', 'Open in a new tab'),
                    ], ['max_items' => 3]),
                    'slides' => self::list('Foto latar', 'Background photos', [
                        'image' => self::f('media', 'Gambar', 'Image', ['required' => true, 'accept' => 'image']),
                        'alt' => self::f('i18n_text', 'Teks alternatif', 'Alt text'),
                    ]),
                ], ['home']),

            'marquee' => self::type('Teks berjalan', 'Marquee',
                'Kata-kata yang berjalan di bawah hero.',
                'Words scrolling under the hero.', [
                    'items' => self::list('Kata', 'Words', ['text' => self::f('text', 'Teks', 'Text', ['required' => true, 'max' => 80])]),
                ], ['home']),

            'stats' => self::type('Angka kunci', 'Key figures',
                'Deretan angka penting (pengalaman, jumlah pabrik, kapasitas). Label/judul opsional di atasnya.',
                'A row of key figures (experience, plants, capacity). Optional label/heading above.', self::labelHeading() + [
                    'items' => self::list('Angka', 'Figures', [
                        'value' => self::f('text', 'Nilai', 'Value', ['required' => true, 'max' => 20]),
                        'unit' => self::f('text', 'Satuan', 'Unit', ['max' => 20]),
                        'label' => self::f('i18n_text', 'Keterangan', 'Label', ['required' => true]),
                    ], ['max_items' => 8]),
                ], ['home']),

            'capabilities' => self::type('Daftar keunggulan', 'Feature list',
                'Baris keunggulan berikon: judul di kiri, uraian di kanan.',
                'Feature rows with an icon: title on the left, description on the right.', self::labelHeading() + [
                    'items' => self::list('Keunggulan', 'Items', [
                        'icon' => self::f('icon', 'Ikon', 'Icon', ['required' => true]),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Body'),
                    ]),
                ], ['home']),

            'product_highlights' => self::type('Sorotan produk', 'Product highlights',
                'Kartu produk andalan (foto opsional, kode, nama, jenis, ringkasan) dengan tautan ke detailnya.',
                'Featured product cards (optional photo, code, name, kind, summary) linking to their details.', self::labelHeading() + [
                    'link_label' => self::f('i18n_text', 'Label tautan', 'Link label'),
                    'link_url' => self::f('url', 'Tautan', 'Link URL'),
                    'items' => self::list('Produk', 'Products', [
                        'image' => self::f('media', 'Foto (opsional)', 'Photo (optional)', ['accept' => 'image']),
                        'code' => self::f('text', 'Kode', 'Code', ['max' => 40]),
                        'name' => self::f('text', 'Nama', 'Name', ['required' => true, 'max' => 120]),
                        'kind' => self::f('text', 'Jenis', 'Kind', ['max' => 120]),
                        'summary' => self::f('i18n_textarea', 'Ringkasan', 'Summary'),
                        'url' => self::f('url', 'Tautan detail', 'Detail URL'),
                    ]),
                ], ['home']),

            'video_gallery' => self::type('Video YouTube', 'YouTube videos',
                'Kartu video YouTube pilihan (thumbnail, judul, keterangan) yang diputar di layar penuh. Video dari menu Galeri memakai tipe Galeri.',
                'Hand-picked YouTube video cards (thumbnail, title, description) played full screen. Videos from the Gallery menu use the Gallery type.', self::labelHeading() + [
                    'videos' => self::list('Video', 'Videos', [
                        'youtube_id' => self::f('text', 'ID video YouTube', 'YouTube video ID', ['required' => true, 'max' => 40]),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                        'desc' => self::f('i18n_textarea', 'Keterangan', 'Description'),
                    ]),
                ], ['home', 'galeri']),

            'cta' => self::type('Ajakan bertindak (CTA)', 'Call to action',
                'Pita ajakan berwarna tema: judul, teks pendek, satu atau dua tombol, dan foto latar opsional.',
                'Theme-coloured call-to-action band: title, short text, one or two buttons, and an optional background photo.', [
                    'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
                    'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                    'body' => self::f('i18n_textarea', 'Teks pendek (opsional)', 'Short text (optional)', ['max' => 300]),
                    'button_label' => self::f('i18n_text', 'Label tombol', 'Button label', ['max' => 40]),
                    'button_url' => self::f('url', 'Tautan tombol', 'Button URL'),
                    'secondary_label' => self::f('i18n_text', 'Label tombol kedua (opsional)', 'Second button label (optional)', ['max' => 40]),
                    'secondary_url' => self::f('url', 'Tautan tombol kedua', 'Second button URL'),
                    'background' => self::f('media', 'Foto latar (opsional)', 'Background photo (optional)', ['accept' => 'image']),
                ]),

            'text_visual' => self::type('Teks & gambar', 'Text & image',
                'Judul, paragraf, dan tombol di satu sisi; foto di sisi lain. Tanpa foto, tampil panel berwarna tema berisi label + kata besar. Kunci section menjadi anchor menu.',
                'Heading, paragraphs, and a button on one side; a photo on the other. Without a photo, a theme-coloured panel shows the label + big word. The section key becomes a menu anchor.', self::labelHeading() + [
                    'body' => self::f('i18n_richtext', 'Isi (pisahkan paragraf dengan baris kosong)', 'Body (blank line between paragraphs)', ['required' => true]),
                    'button_label' => self::f('i18n_text', 'Label tombol', 'Button label'),
                    'button_url' => self::f('url', 'Tautan tombol', 'Button URL'),
                    'image' => self::f('media', 'Foto (opsional)', 'Photo (optional)', ['accept' => 'image']),
                    'image_alt' => self::f('i18n_text', 'Teks alternatif foto', 'Photo alt text', ['max' => 160]),
                    'image_side' => self::f('select', 'Posisi foto / panel', 'Photo / panel position', ['options' => ['right' => 'Kanan', 'left' => 'Kiri'], 'default' => 'right']),
                    'visual_label' => self::f('text', 'Label panel / keterangan foto', 'Panel label / photo caption', ['max' => 40]),
                    'visual_mark' => self::f('text', 'Kata besar panel (tanpa foto)', 'Panel big word (no photo)', ['max' => 20]),
                ], ['tentang', 'bisnis', 'keberlanjutan']),

            'timeline' => self::type('Linimasa', 'Timeline',
                'Tonggak berurutan di sepanjang "jalan" waktu (sejarah perusahaan): nama entitas di atas pin tahun, kotak uraian + produk di bawahnya; geser mendatar di layar lebar. Di halaman Tentang menjadi anchor #sejarah.',
                'Milestones along a time "road" (company history): entity name above the year pin, description + products box below; horizontal scroll on wide screens. On the About page it is the #sejarah anchor.', self::labelHeading() + [
                    'items' => self::list('Tonggak', 'Milestones', [
                        'year' => self::f('text', 'Tahun (label pin)', 'Year (pin label)', ['required' => true, 'max' => 24]),
                        'name' => self::f('i18n_text', 'Nama entitas / tahap (di atas pin)', 'Entity / stage name (above the pin)'),
                        'title' => self::f('i18n_text', 'Periode / judul (baris pertama kotak)', 'Period / title (first line of the box)', ['required' => true]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Body'),
                        'products' => self::f('i18n_text', 'Produk', 'Products'),
                    ]),
                ], ['tentang']),

            'vision_mission' => self::type('Visi & misi', 'Vision & mission',
                'Visi perusahaan dan butir-butir misi.',
                'Company vision and mission points.', self::labelHeading() + [
                    'vision_tag' => self::f('i18n_text', 'Tag visi', 'Vision tag'),
                    'vision' => self::f('i18n_textarea', 'Visi', 'Vision', ['required' => true]),
                    'mission_tag' => self::f('i18n_text', 'Tag misi', 'Mission tag'),
                    'missions' => self::i18nList('Butir misi', 'Mission points'),
                ], ['tentang']),

            'values' => self::type('Nilai perusahaan', 'Company values',
                'Nilai inti (mis. AKHLAK) dengan uraian singkat.',
                'Core values (e.g. AKHLAK) with short descriptions.', self::labelHeading() + [
                    'items' => self::list('Nilai', 'Values', [
                        'title' => self::f('i18n_text', 'Nama nilai', 'Value name', ['required' => true]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Description'),
                    ]),
                ], ['tentang']),

            'org_chart' => self::type('Struktur organisasi', 'Organisation chart',
                'Bagan hierarki yang bisa dibuka-tutup. Tiap simpul punya kunci unik dan kunci induk (kosong = puncak bagan).',
                'Collapsible hierarchy chart. Each node has a unique key and a parent key (empty = top of the chart).', self::labelHeading() + [
                    'lead' => self::f('i18n_textarea', 'Teks pengantar', 'Lead text'),
                    'expand_depth' => self::f('number', 'Jumlah tingkat terbuka saat dimuat', 'Levels expanded on load'),
                    'nodes' => self::list('Simpul (jabatan)', 'Nodes (positions)', [
                        'key' => self::f('text', 'Kunci unik', 'Unique key', ['required' => true, 'max' => 40]),
                        'parent' => self::f('text', 'Kunci induk (kosong = puncak)', 'Parent key (empty = top)', ['max' => 40]),
                        'title' => self::f('i18n_text', 'Jabatan', 'Position', ['required' => true, 'max' => 120]),
                        'holder' => self::f('text', 'Nama pejabat (opsional)', 'Holder name (optional)', ['max' => 120]),
                        // Warna kartu & legenda; kosong = diturunkan dari kedalaman simpul.
                        'level' => self::f('select', 'Tingkat (warna & legenda)', 'Level (colour & legend)', ['options' => self::ORG_LEVELS]),
                    ], ['max_items' => 300]),
                ], ['tentang']),

            'contact_info' => self::type('Informasi kontak', 'Contact information',
                'Lokasi, telepon, email, dan media sosial. Dipakai juga di footer.',
                'Locations, phones, emails, and social media. Also used in the footer.', [
                    'locations' => self::list('Lokasi', 'Locations', [
                        'name' => self::f('i18n_text', 'Nama lokasi', 'Location name', ['required' => true]),
                        'address' => self::f('textarea', 'Alamat', 'Address', ['required' => true, 'max' => 500]),
                        'phones' => self::list('Telepon', 'Phones', ['number' => self::f('text', 'Nomor', 'Number', ['required' => true, 'max' => 40])]),
                        // Pin peta (Leaflet/OSM) di halaman Kontak; lokasi pertama juga tampil di footer. Kosong = tanpa pin.
                        'geo' => self::f('geo', 'Titik peta', 'Map point'),
                    ]),
                    'background' => self::f('media', 'Foto latar blok kontak (opsional)', 'Contact block background photo (optional)', ['accept' => 'image']),
                    'emails' => self::list('Email', 'Emails', ['address' => self::f('text', 'Alamat email', 'Email address', ['required' => true, 'max' => 120])]),
                    'social' => self::list('Media sosial', 'Social media', [
                        'label' => self::f('text', 'Platform', 'Platform', ['required' => true, 'max' => 40]),
                        'handle' => self::f('text', 'Akun', 'Handle', ['max' => 80]),
                        'url' => self::f('url', 'Tautan', 'URL', ['required' => true]),
                        // Ikon unggahan (PNG/SVG) opsional; kosong = ikon bawaan FE menurut platform (Instagram, YouTube, TikTok, ...).
                        'icon' => self::f('media', 'Ikon (opsional)', 'Icon (optional)', ['accept' => 'image']),
                    ]),
                ], ['kontak']),

            'contact_form' => self::type('Formulir kontak', 'Contact form',
                'Formulir kirim pesan (tersimpan di Pesan Kontak admin).',
                'Message form (stored under admin Contact Messages).', [
                    'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
                    'success_title' => self::f('i18n_text', 'Judul sukses', 'Success title'),
                    'success_body' => self::f('i18n_textarea', 'Teks sukses', 'Success text'),
                ], ['kontak']),

            'contact_summary' => self::type('Ringkasan kontak', 'Contact summary',
                'Lokasi, email, dan media sosial diambil dari section Informasi kontak halaman Kontak (tidak perlu diisi dua kali), plus tombol ke formulir. Anchor #hubungi-kami untuk menu.',
                'Locations, emails, and social links come from the Contact page’s contact information section (no double entry), plus a button to the form. Anchor #hubungi-kami for menus.', [
                    'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
                    'heading' => self::f('i18n_text', 'Judul bagian', 'Section heading'),
                    'lead' => self::f('i18n_textarea', 'Teks pengantar', 'Lead text'),
                    'button_label' => self::f('i18n_text', 'Label tombol', 'Button label'),
                    'button_url' => self::f('url', 'Tautan tombol', 'Button URL'),
                ]),

            'link_cards' => self::type('Kartu tautan', 'Link cards',
                'Kisi kartu berikon menuju halaman lain (sub-halaman Keberlanjutan, katalog, unduhan).',
                'Grid of icon cards linking to other pages (Sustainability sub-pages, catalog, downloads).', array_merge(self::labelHeading(), [
                    'lead' => self::f('i18n_textarea', 'Teks pengantar', 'Lead text'),
                    'items' => self::list('Kartu', 'Cards', [
                        'icon' => self::f('icon', 'Ikon', 'Icon'),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true, 'max' => 80]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Description', ['max' => 300]),
                        'url' => self::f('url', 'Tautan', 'URL', ['required' => true]),
                        'link_label' => self::f('i18n_text', 'Label tautan', 'Link label', ['max' => 40]),
                    ], ['max_items' => 8]),
                ]), ['media', 'bisnis']),

            'pillars' => self::type('Kartu pilar', 'Pillar cards',
                'Kartu berikon dengan uraian dan daftar poin (mis. pilar lingkungan, sosial, tata kelola). Label/judul opsional di atasnya.',
                'Icon cards with a description and a point list (e.g. environment, social, governance pillars). Optional label/heading above.', self::labelHeading() + [
                    'items' => self::list('Pilar', 'Pillars', [
                        'key' => self::f('text', 'Kunci (anchor)', 'Key (anchor)', ['max' => 40]),
                        'icon' => self::f('icon', 'Ikon', 'Icon', ['required' => true]),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Body'),
                        'points' => self::i18nList('Poin', 'Points'),
                    ]),
                ], ['keberlanjutan']),

            'info_blocks' => self::type('Blok informasi', 'Info blocks',
                'Beberapa blok teks berlabel dengan daftar poin (mis. penjelasan WBS). Label/judul opsional di atasnya.',
                'Labelled text blocks with point lists (e.g. WBS explanation). Optional label/heading above.', self::labelHeading() + [
                    'blocks' => self::list('Blok', 'Blocks', [
                        'label' => self::f('i18n_text', 'Label', 'Label', ['required' => true]),
                        'body' => self::f('i18n_textarea', 'Teks', 'Text'),
                        'points' => self::i18nList('Poin', 'Points'),
                    ]),
                ], ['keberlanjutan']),

            'wbs_form' => self::type('Formulir WBS', 'WBS form',
                'Formulir pelaporan whistle blowing.',
                'Whistle blowing report form.', [
                    'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
                    'success_title' => self::f('i18n_text', 'Judul sukses', 'Success title'),
                    'success_body' => self::f('i18n_textarea', 'Teks sukses', 'Success text'),
                ], ['keberlanjutan']),

            'customer_logos' => self::type('Logo pelanggan', 'Customer logos',
                'Label/judul opsional, paragraf pengantar; daftar logo diambil dari menu Logo Pelanggan.',
                'Optional label/heading, intro paragraph; logos come from the Customer Logos menu.', self::labelHeading() + [
                    'lead' => self::f('i18n_textarea', 'Pengantar', 'Intro'),
                ], ['keberlanjutan']),

            'certificates' => self::type('Daftar sertifikat', 'Certificate list',
                'Label/judul opsional; daftar sertifikat dari menu Sertifikat.',
                'Optional label/heading; certificates from the Certificates menu.', self::labelHeading() + [
                    'layout' => self::f('select', 'Tata letak', 'Layout', ['options' => ['list' => 'Daftar baris (logo kiri)', 'grid' => 'Kartu lencana (logo besar)'], 'default' => 'list']),
                    'empty_text' => self::f('i18n_text', 'Teks bila kosong', 'Empty text'),
                ], ['keberlanjutan']),

            'brochures' => self::type('Daftar brosur', 'Brochure list',
                'Label/judul opsional; daftar unduhan dari menu Brosur.',
                'Optional label/heading; downloads from the Brochures menu.', self::labelHeading() + [
                    'empty_text' => self::f('i18n_text', 'Teks bila kosong', 'Empty text'),
                ], ['bisnis']),

            'gallery' => self::type('Galeri (menu Galeri)', 'Gallery (Gallery menu)',
                'Tab foto dan video berisi seluruh item menu Galeri, dengan pembesar foto.',
                'Photo and video tabs listing every item of the Gallery menu, with a lightbox.', [
                    'photos_label' => self::f('i18n_text', 'Label foto', 'Photos label'),
                    'videos_label' => self::f('i18n_text', 'Label video', 'Videos label'),
                    'empty_text' => self::f('i18n_text', 'Teks bila kosong', 'Empty text'),
                ], ['galeri']),

            'news' => self::type('Daftar berita', 'News list',
                'Seluruh berita terbit dari menu Berita dengan filter kategori. Untuk beberapa berita terbaru saja pakai tipe Berita terbaru.',
                'All published posts from the News menu with a category filter. For just the latest few use the Latest news type.', [
                    'empty_text' => self::f('i18n_text', 'Teks bila kosong', 'Empty text'),
                ], ['berita']),

            'latest_news' => self::type('Berita terbaru', 'Latest news',
                'Kartu beberapa berita terbit terbaru dan tautan ke halaman Berita. Cocok untuk beranda atau halaman profil.',
                'Cards for the latest published posts and a link to the News page. Fits the home or profile pages.', self::labelHeading() + [
                    'count' => self::f('number', 'Jumlah berita (1-6, bawaan 3)', 'Number of posts (1-6, default 3)'),
                    'link_label' => self::f('i18n_text', 'Label tautan', 'Link label', ['max' => 40]),
                    'link_url' => self::f('url', 'Tautan (bawaan /berita)', 'Link URL (default /berita)'),
                ]),

            'steps' => self::type('Langkah proses', 'Process steps',
                'Alur berurutan (proses produksi, cara pemesanan): ikon, judul, dan uraian tiap langkah.',
                'A sequential flow (production process, how to order): icon, title, and description per step.', self::labelHeading() + [
                    'lead' => self::f('i18n_textarea', 'Teks pengantar', 'Lead text'),
                    'items' => self::list('Langkah', 'Steps', [
                        'icon' => self::f('icon', 'Ikon (opsional)', 'Icon (optional)'),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true, 'max' => 80]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Description', ['max' => 400]),
                    ], ['max_items' => 8]),
                ]),

            'icon_features' => self::type('Fitur berikon', 'Icon features',
                'Judul di tengah lalu 2-4 kolom: ikon dalam lingkaran, judul, dan uraian singkat (mis. "Mengapa memilih kami?"). Ikon bisa dari daftar atau gambar sendiri.',
                'A centred heading followed by 2-4 columns: a circled icon, title, and short text (e.g. "Why choose us?"). Icons come from the set or your own image.', self::labelHeading() + [
                    'lead' => self::f('i18n_textarea', 'Teks pengantar', 'Lead text'),
                    'columns' => self::f('select', 'Jumlah kolom (layar lebar)', 'Columns (wide screens)', ['options' => ['auto' => 'Otomatis (ikut jumlah item, maks 4)', '2' => '2 kolom', '3' => '3 kolom', '4' => '4 kolom'], 'default' => 'auto']),
                    'icon_style' => self::f('select', 'Gaya ikon', 'Icon style', ['options' => ['outline' => 'Lingkaran garis', 'soft' => 'Lingkaran berwarna lembut', 'solid' => 'Lingkaran warna tema', 'plain' => 'Tanpa lingkaran'], 'default' => 'outline']),
                    'align' => self::f('select', 'Perataan', 'Alignment', ['options' => ['center' => 'Tengah', 'left' => 'Kiri'], 'default' => 'center']),
                    'items' => self::list('Fitur', 'Features', [
                        'icon' => self::f('icon', 'Ikon', 'Icon'),
                        'image' => self::f('media', 'Gambar ikon (opsional, menggantikan ikon)', 'Icon image (optional, replaces the icon)', ['accept' => 'image']),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true, 'max' => 80]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Description', ['max' => 300]),
                    ], ['max_items' => 8]),
                ]),

            'faq' => self::type('Tanya jawab (FAQ)', 'FAQ',
                'Daftar pertanyaan yang bisa dibuka-tutup beserta jawabannya.',
                'A list of collapsible questions with their answers.', self::labelHeading() + [
                    'lead' => self::f('i18n_textarea', 'Teks pengantar', 'Lead text'),
                    'items' => self::list('Pertanyaan', 'Questions', [
                        'question' => self::f('i18n_text', 'Pertanyaan', 'Question', ['required' => true, 'max' => 200]),
                        'answer' => self::f('i18n_textarea', 'Jawaban', 'Answer', ['required' => true, 'max' => 2000]),
                    ], ['max_items' => 30]),
                ]),

            'spec_table' => self::type('Tabel spesifikasi', 'Specification table',
                'Pasangan parameter dan nilai (data teknis produk, fakta perusahaan) dengan catatan kaki opsional.',
                'Parameter and value pairs (product technical data, company facts) with an optional footnote.', self::labelHeading() + [
                    'lead' => self::f('i18n_textarea', 'Teks pengantar', 'Lead text'),
                    'rows' => self::list('Baris', 'Rows', [
                        'label' => self::f('i18n_text', 'Parameter', 'Parameter', ['required' => true, 'max' => 120]),
                        'value' => self::f('i18n_text', 'Nilai', 'Value', ['required' => true, 'max' => 200]),
                    ], ['max_items' => 40]),
                    'note' => self::f('i18n_textarea', 'Catatan kaki (opsional)', 'Footnote (optional)', ['max' => 500]),
                ]),

            'team' => self::type('Profil pimpinan', 'Leadership profiles',
                'Kartu orang: foto, nama, jabatan, dan profil singkat (direksi, komisaris, tim).',
                'People cards: photo, name, position, and a short profile (directors, commissioners, teams).', self::labelHeading() + [
                    'lead' => self::f('i18n_textarea', 'Teks pengantar', 'Lead text'),
                    'items' => self::list('Orang', 'People', [
                        'photo' => self::f('media', 'Foto (opsional)', 'Photo (optional)', ['accept' => 'image']),
                        'name' => self::f('text', 'Nama', 'Name', ['required' => true, 'max' => 120]),
                        'position' => self::f('i18n_text', 'Jabatan', 'Position', ['max' => 120]),
                        'bio' => self::f('i18n_textarea', 'Profil singkat', 'Short profile', ['max' => 600]),
                    ], ['max_items' => 24]),
                ]),

            'testimonials' => self::type('Testimoni', 'Testimonials',
                'Kutipan pelanggan atau mitra beserta nama, jabatan, dan perusahaannya.',
                'Customer or partner quotes with their name, role, and company.', self::labelHeading() + [
                    'items' => self::list('Testimoni', 'Testimonials', [
                        'quote' => self::f('i18n_textarea', 'Kutipan', 'Quote', ['required' => true, 'max' => 400]),
                        'name' => self::f('text', 'Nama', 'Name', ['required' => true, 'max' => 120]),
                        'role' => self::f('i18n_text', 'Jabatan', 'Role', ['max' => 120]),
                        'company' => self::f('text', 'Perusahaan', 'Company', ['max' => 120]),
                        'photo' => self::f('media', 'Foto (opsional)', 'Photo (optional)', ['accept' => 'image']),
                    ], ['max_items' => 12]),
                ]),

            'image_grid' => self::type('Kisi foto', 'Photo grid',
                'Foto pilihan dengan keterangan; klik untuk memperbesar. Berbeda dari Galeri yang mengambil semua item menu Galeri.',
                'Hand-picked photos with captions; click to enlarge. Unlike Gallery, which lists every Gallery menu item.', self::labelHeading() + [
                    'lead' => self::f('i18n_textarea', 'Teks pengantar', 'Lead text'),
                    'items' => self::list('Foto', 'Photos', [
                        'image' => self::f('media', 'Foto', 'Photo', ['required' => true, 'accept' => 'image']),
                        'caption' => self::f('i18n_text', 'Keterangan', 'Caption', ['max' => 160]),
                    ], ['max_items' => 24]),
                ]),

            'rich_text' => self::type('Teks bebas', 'Rich text',
                'Blok teks dari editor (judul, daftar, tabel, gambar, video) dengan label/judul opsional.',
                'An editor text block (headings, lists, tables, images, video) with an optional label/heading.', self::labelHeading() + [
                    'body' => self::f('i18n_richtext', 'Isi', 'Body', ['required' => true]),
                ]),
        ];
    }
}
