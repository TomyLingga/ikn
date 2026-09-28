<?php

namespace App\Services\Cms;

/**
 * Definisi skema tiap tipe section. Nama field mengikuti section yang ADA di mockup
 * ikn-fe (KEPUTUSAN: admin tidak bisa merusak desain). Menambah tipe = tambah entri di sini
 * plus renderer di ikn-fe/components/cms/sections.
 */
final class SectionDefinitions
{
    private static function f(string $type, string $id, string $en, array $extra = []): array
    {
        return array_merge(['type' => $type, 'name' => ['id' => $id, 'en' => $en]], $extra);
    }

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

    public static function all(): array
    {
        return [
            'page_header' => self::type('Kepala halaman', 'Page header',
                'Label, judul besar, dan paragraf pembuka di atas halaman.',
                'Eyebrow label, display title, and lead paragraph at the top of a page.', [
                    'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
                    'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                    'lead' => self::f('i18n_textarea', 'Paragraf pembuka', 'Lead paragraph'),
                    'breadcrumb' => self::f('boolean', 'Tampilkan breadcrumb', 'Show breadcrumb'),
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

            'stats' => self::type('Baris angka', 'Stats row',
                'Angka-angka kunci (pengalaman, pabrik, dll).',
                'Key figures (experience, plants, etc).', [
                    'items' => self::list('Angka', 'Figures', [
                        'value' => self::f('text', 'Nilai', 'Value', ['required' => true, 'max' => 20]),
                        'unit' => self::f('text', 'Satuan', 'Unit', ['max' => 20]),
                        'label' => self::f('i18n_text', 'Keterangan', 'Label', ['required' => true]),
                    ]),
                ], ['home']),

            'capabilities' => self::type('Keunggulan', 'Capabilities',
                'Daftar keunggulan dengan ikon.',
                'List of strengths with icons.', self::labelHeading() + [
                    'items' => self::list('Keunggulan', 'Items', [
                        'icon' => self::f('icon', 'Ikon', 'Icon', ['required' => true]),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Body'),
                    ]),
                ], ['home']),

            'product_highlights' => self::type('Sorotan produk', 'Product highlights',
                'Kartu produk andalan (kode, nama, jenis, ringkasan).',
                'Featured product cards (code, name, kind, summary).', self::labelHeading() + [
                    'link_label' => self::f('i18n_text', 'Label tautan', 'Link label'),
                    'link_url' => self::f('url', 'Tautan', 'Link URL'),
                    'items' => self::list('Produk', 'Products', [
                        'code' => self::f('text', 'Kode', 'Code', ['max' => 40]),
                        'name' => self::f('text', 'Nama', 'Name', ['required' => true, 'max' => 120]),
                        'kind' => self::f('text', 'Jenis', 'Kind', ['max' => 120]),
                        'summary' => self::f('i18n_textarea', 'Ringkasan', 'Summary'),
                        'url' => self::f('url', 'Tautan detail', 'Detail URL'),
                    ]),
                ], ['home']),

            'video_gallery' => self::type('Galeri video', 'Video gallery',
                'Video YouTube dengan judul dan keterangan.',
                'YouTube videos with title and description.', self::labelHeading() + [
                    'videos' => self::list('Video', 'Videos', [
                        'youtube_id' => self::f('text', 'ID video YouTube', 'YouTube video ID', ['required' => true, 'max' => 40]),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                        'desc' => self::f('i18n_textarea', 'Keterangan', 'Description'),
                    ]),
                ], ['home', 'galeri']),

            'cta' => self::type('Ajakan (CTA)', 'Call to action',
                'Blok ajakan dengan satu tombol.',
                'Call-to-action block with one button.', [
                    'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
                    'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                    'button_label' => self::f('i18n_text', 'Label tombol', 'Button label'),
                    'button_url' => self::f('url', 'Tautan tombol', 'Button URL'),
                ]),

            'text_visual' => self::type('Teks + visual', 'Text with visual',
                'Paragraf di kiri, blok visual (label + kata) di kanan. Dipakai profil dan REACH.',
                'Paragraphs on the left, a visual block (label + word) on the right.', self::labelHeading() + [
                    'body' => self::f('i18n_richtext', 'Isi (pisahkan paragraf dengan baris kosong)', 'Body (blank line between paragraphs)', ['required' => true]),
                    'button_label' => self::f('i18n_text', 'Label tombol', 'Button label'),
                    'button_url' => self::f('url', 'Tautan tombol', 'Button URL'),
                    'visual_label' => self::f('text', 'Label visual', 'Visual label', ['max' => 40]),
                    'visual_mark' => self::f('text', 'Kata visual', 'Visual mark', ['max' => 20]),
                ], ['tentang', 'reach']),

            'timeline' => self::type('Linimasa sejarah', 'History timeline',
                'Tonggak sejarah perusahaan.',
                'Company milestones.', self::labelHeading() + [
                    'items' => self::list('Tonggak', 'Milestones', [
                        'year' => self::f('text', 'Tahun', 'Year', ['required' => true, 'max' => 20]),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Body'),
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

            'contact_info' => self::type('Informasi kontak', 'Contact information',
                'Lokasi, telepon, email, dan media sosial. Dipakai juga di footer.',
                'Locations, phones, emails, and social media. Also used in the footer.', [
                    'locations' => self::list('Lokasi', 'Locations', [
                        'name' => self::f('i18n_text', 'Nama lokasi', 'Location name', ['required' => true]),
                        'address' => self::f('textarea', 'Alamat', 'Address', ['required' => true, 'max' => 500]),
                        'phones' => self::list('Telepon', 'Phones', ['number' => self::f('text', 'Nomor', 'Number', ['required' => true, 'max' => 40])]),
                    ]),
                    'emails' => self::list('Email', 'Emails', ['address' => self::f('text', 'Alamat email', 'Email address', ['required' => true, 'max' => 120])]),
                    'social' => self::list('Media sosial', 'Social media', [
                        'label' => self::f('text', 'Platform', 'Platform', ['required' => true, 'max' => 40]),
                        'handle' => self::f('text', 'Akun', 'Handle', ['max' => 80]),
                        'url' => self::f('url', 'Tautan', 'URL', ['required' => true]),
                    ]),
                ], ['kontak']),

            'contact_form' => self::type('Formulir kontak', 'Contact form',
                'Formulir kirim pesan (tersimpan di Pesan Kontak admin).',
                'Message form (stored under admin Contact Messages).', [
                    'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
                    'success_title' => self::f('i18n_text', 'Judul sukses', 'Success title'),
                    'success_body' => self::f('i18n_textarea', 'Teks sukses', 'Success text'),
                ], ['kontak']),

            'pillars' => self::type('Pilar keberlanjutan', 'Sustainability pillars',
                'Kartu pilar (lingkungan, sosial, tata kelola) dengan poin-poin.',
                'Pillar cards (environment, social, governance) with points.', [
                    'items' => self::list('Pilar', 'Pillars', [
                        'key' => self::f('text', 'Kunci (anchor)', 'Key (anchor)', ['max' => 40]),
                        'icon' => self::f('icon', 'Ikon', 'Icon', ['required' => true]),
                        'title' => self::f('i18n_text', 'Judul', 'Title', ['required' => true]),
                        'body' => self::f('i18n_textarea', 'Uraian', 'Body'),
                        'points' => self::i18nList('Poin', 'Points'),
                    ]),
                ], ['keberlanjutan']),

            'info_blocks' => self::type('Blok informasi', 'Info blocks',
                'Beberapa blok teks berlabel dengan daftar poin (mis. penjelasan WBS).',
                'Labelled text blocks with point lists (e.g. WBS explanation).', [
                    'blocks' => self::list('Blok', 'Blocks', [
                        'label' => self::f('i18n_text', 'Label', 'Label', ['required' => true]),
                        'body' => self::f('i18n_textarea', 'Teks', 'Text'),
                        'points' => self::i18nList('Poin', 'Points'),
                    ]),
                ], ['whistleblowing']),

            'wbs_form' => self::type('Formulir WBS', 'WBS form',
                'Formulir pelaporan whistle blowing.',
                'Whistle blowing report form.', [
                    'label' => self::f('i18n_text', 'Label kecil', 'Eyebrow label'),
                    'success_title' => self::f('i18n_text', 'Judul sukses', 'Success title'),
                    'success_body' => self::f('i18n_textarea', 'Teks sukses', 'Success text'),
                ], ['whistleblowing']),

            'customer_logos' => self::type('Logo pelanggan', 'Customer logos',
                'Paragraf pengantar; daftar logo diambil dari menu Logo Pelanggan.',
                'Intro paragraph; logos come from the Customer Logos menu.', [
                    'lead' => self::f('i18n_textarea', 'Pengantar', 'Intro'),
                ], ['pelanggan']),

            'certificates' => self::type('Daftar sertifikat', 'Certificate list',
                'Daftar sertifikat dari menu Sertifikat.',
                'Certificates from the Certificates menu.', [
                    'empty_text' => self::f('i18n_text', 'Teks bila kosong', 'Empty text'),
                ], ['sertifikat']),

            'brochures' => self::type('Daftar brosur', 'Brochure list',
                'Daftar unduhan dari menu Brosur.',
                'Downloads from the Brochures menu.', [
                    'empty_text' => self::f('i18n_text', 'Teks bila kosong', 'Empty text'),
                ], ['unduhan']),

            'gallery' => self::type('Galeri foto & video', 'Photo & video gallery',
                'Foto dan video dari menu Galeri.',
                'Photos and videos from the Gallery menu.', [
                    'photos_label' => self::f('i18n_text', 'Label foto', 'Photos label'),
                    'videos_label' => self::f('i18n_text', 'Label video', 'Videos label'),
                    'empty_text' => self::f('i18n_text', 'Teks bila kosong', 'Empty text'),
                ], ['galeri']),

            'news' => self::type('Daftar berita', 'News list',
                'Berita terbit dari menu Berita.',
                'Published posts from the News menu.', [
                    'empty_text' => self::f('i18n_text', 'Teks bila kosong', 'Empty text'),
                ], ['berita']),

            'rich_text' => self::type('Teks bebas', 'Rich text',
                'Blok teks umum dengan judul.',
                'Generic text block with heading.', self::labelHeading() + [
                    'body' => self::f('i18n_richtext', 'Isi', 'Body', ['required' => true]),
                ]),
        ];
    }
}
