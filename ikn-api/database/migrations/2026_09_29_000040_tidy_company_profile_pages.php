<?php

use Database\Seeders\CmsPageSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Perapian halaman company profile untuk basis data yang sudah terisi (instalasi baru mendapat isi yang sama dari seeder):
//  - halaman /produk menjadi /bisnis: judul, header, section lini bisnis (text_visual) + kartu tautan (link_cards);
//    URL /produk di menu dan di konten beranda menjadi /bisnis;
//  - item menu "Hubungi Kami" di bawah Tentang Kami dan section contact_summary halaman Tentang dihapus;
//  - halaman Keberlanjutan mendapat section link_cards ke sub-halamannya;
//  - label/judul header Kontak, Keberlanjutan, Berita, Galeri dirapikan hanya bila masih persis nilai seed lama
//    (suntingan admin tidak ditimpa).
class TidyCompanyProfilePages extends Migration
{
    private const URLS = [
        '/produk#resiprene-35' => '/bisnis#resiprene-35',
        '/produk#barang-karet' => '/bisnis#barang-karet',
        '/produk' => '/bisnis',
    ];

    public function up(): void
    {
        $t = fn (string $id, string $en) => ['id' => $id, 'en' => $en];

        // Hubungi Kami di bawah Tentang Kami (header & footer) + section ringkasan kontak halaman Tentang.
        $this->contactMenuItems('/tentang#hubungi-kami')->delete();
        $this->deleteSection('tentang', 'contact', 'contact_summary');

        // /produk -> /bisnis.
        $produk = DB::table('pages')->where('slug', 'produk')->first(['id']);
        if ($produk && ! DB::table('pages')->where('slug', 'bisnis')->exists()) {
            DB::table('pages')->where('id', $produk->id)->update([
                'slug' => 'bisnis',
                'title' => $this->json($t('Bisnis', 'Business')),
                'seo' => $this->json(['title' => $t('Bisnis', 'Business'), 'description' => $t(
                    'Lini bisnis PT Industri Karet Nusantara — Resiprene 35 (cyclised natural rubber) dan aneka barang karet industri, tersedia di katalog online.',
                    'PT Industri Karet Nusantara’s business lines — Resiprene 35 (cyclised natural rubber) and industrial rubber articles, available in the online catalog.'
                )]),
                'updated_at' => now(),
            ]);
        }
        if ($bisnis = $this->pageId('bisnis')) {
            $sections = CmsPageSeeder::businessSections($t);
            $this->patchSection($bisnis, 'header', 'label', '/ 02 — Produk', $sections[0]['content']);
            foreach ($sections as $index => $section) {
                $this->insertSectionIfMissing($bisnis, $section, $index);
            }
            DB::table('page_sections')->where('page_id', $bisnis)->where('key', 'cta')->update(['sort_order' => count($sections)]);
        }
        foreach (self::URLS as $old => $new) {
            DB::table('menu_items')->where('url', $old)->update(['url' => $new, 'updated_at' => now()]);
        }
        $this->replaceInPageContent('home', '"/produk', '"/bisnis');

        // Keberlanjutan: label header + kartu tautan sub-halaman.
        if ($keberlanjutan = $this->pageId('keberlanjutan')) {
            $this->patchSection($keberlanjutan, 'header', 'label', '/ 05 — Keberlanjutan', ['label' => $t('/ Keberlanjutan', '/ Sustainability')]);
            $order = (int) DB::table('page_sections')->where('page_id', $keberlanjutan)->max('sort_order');
            $this->insertSectionIfMissing($keberlanjutan, ['key' => 'links', 'type' => 'link_cards', 'content' => CmsPageSeeder::sustainabilityLinks($t)], $order + 1);
        }

        // Kontak, Berita, Galeri: label/judul header.
        if ($kontak = $this->pageId('kontak')) {
            $this->patchSection($kontak, 'header', 'label', '/ 04 — Kontak', ['label' => $t('/ Kontak', '/ Contact')]);
        }
        if ($berita = $this->pageId('berita')) {
            $this->patchSection($berita, 'header', 'label', '/ 03 — Berita', [
                'label' => $t('/ Media — Berita', '/ Media — News'),
                'title' => $t('Berita perusahaan.', 'Company news.'),
                'lead' => $t('Informasi terbaru mengenai perusahaan, produk, kegiatan, dan kemitraan PT Industri Karet Nusantara.', 'The latest on the company, products, activities, and partnerships of PT Industri Karet Nusantara.'),
            ]);
        }
        if ($galeri = $this->pageId('galeri')) {
            $this->patchSection($galeri, 'header', 'title', 'Dari dekat.', ['title' => $t('Galeri foto & video.', 'Photo & video gallery.')]);
        }
    }

    public function down(): void
    {
        $t = fn (string $id, string $en) => ['id' => $id, 'en' => $en];

        if ($galeri = $this->pageId('galeri')) {
            $this->patchSection($galeri, 'header', 'title', 'Galeri foto & video.', ['title' => $t('Dari dekat.', 'Up close.')]);
        }
        if ($berita = $this->pageId('berita')) {
            $this->patchSection($berita, 'header', 'label', '/ Media — Berita', [
                'label' => $t('/ 03 — Berita', '/ 03 — News'),
                'title' => $t('Kabar terbaru.', 'Latest news.'),
                'lead' => $t('Ikuti kegiatan, rilis produk, dan perkembangan terkini PT Industri Karet Nusantara.', 'Follow the activities, product releases, and latest developments of PT Industri Karet Nusantara.'),
            ]);
        }
        if ($kontak = $this->pageId('kontak')) {
            $this->patchSection($kontak, 'header', 'label', '/ Kontak', ['label' => $t('/ 04 — Kontak', '/ 04 — Contact')]);
        }
        if ($keberlanjutan = $this->pageId('keberlanjutan')) {
            $this->deleteSection('keberlanjutan', 'links', 'link_cards');
            $this->patchSection($keberlanjutan, 'header', 'label', '/ Keberlanjutan', ['label' => $t('/ 05 — Keberlanjutan', '/ 05 — Sustainability')]);
        }

        $this->replaceInPageContent('home', '"/bisnis', '"/produk');
        foreach (array_flip(self::URLS) as $old => $new) {
            DB::table('menu_items')->where('url', $old)->update(['url' => $new, 'updated_at' => now()]);
        }
        if ($bisnis = $this->pageId('bisnis')) {
            foreach (['resiprene-35' => 'text_visual', 'barang-karet' => 'text_visual', 'links' => 'link_cards'] as $key => $type) {
                $this->deleteSection('bisnis', $key, $type);
            }
            $this->patchSection($bisnis, 'header', 'label', '/ Bisnis', [
                'label' => $t('/ 02 — Produk', '/ 02 — Products'),
                'title' => $t('Karet hilir bernilai tambah.', 'Value-added downstream rubber.'),
                'lead' => $t('Dari karet alam Nusantara, kami menghadirkan produk hilir siap pakai untuk industri cat, otomotif, dan infrastruktur.', 'From Nusantara natural rubber, we deliver ready-to-use downstream products for the paint, automotive, and infrastructure industries.'),
            ]);
            DB::table('page_sections')->where('page_id', $bisnis)->where('key', 'cta')->update(['sort_order' => 1]);
            if (! DB::table('pages')->where('slug', 'produk')->exists()) {
                DB::table('pages')->where('id', $bisnis)->update([
                    'slug' => 'produk',
                    'title' => $this->json($t('Produk', 'Products')),
                    'seo' => $this->json(['title' => $t('Produk', 'Products'), 'description' => $t(
                        'Produk hilir karet PT Industri Karet Nusantara — Resiprene 35 dan aneka barang karet industri.',
                        'Downstream rubber products of PT Industri Karet Nusantara — Resiprene 35 and industrial rubber articles.'
                    )]),
                    'updated_at' => now(),
                ]);
            }
        }

        // Kembalikan section ringkasan kontak + item menu Hubungi Kami (seperti migrasi 2026_09_29_000020).
        if ($tentang = $this->pageId('tentang')) {
            $order = (int) DB::table('page_sections')->where('page_id', $tentang)->max('sort_order');
            $this->insertSectionIfMissing($tentang, ['key' => 'contact', 'type' => 'contact_summary', 'content' => [
                'label' => $t('/ Hubungi kami', '/ Contact us'),
                'heading' => $t('Mari terhubung.', 'Let’s connect.'),
                'lead' => $t('Punya pertanyaan seputar produk, kemitraan, atau kunjungan pabrik? Tim kami siap membantu.', 'Questions about products, partnerships, or plant visits? Our team is ready to help.'),
                'button_label' => $t('Kirim pesan', 'Send a message'),
                'button_url' => '/kontak',
            ]], $order + 1);
        }
        foreach (DB::table('menu_items')->where('key', 'tentang')->get(['id', 'menu_id']) as $parent) {
            if ($this->contactMenuItems('/tentang#hubungi-kami')->where('parent_id', $parent->id)->exists()) {
                continue;
            }
            $order = (int) DB::table('menu_items')->where('parent_id', $parent->id)->max('sort_order');
            DB::table('menu_items')->insert([
                'menu_id' => $parent->menu_id,
                'parent_id' => $parent->id,
                'key' => null,
                'label' => $this->json($t('Hubungi Kami', 'Contact Us')),
                'description' => $this->json($t('Lokasi & kontak', 'Locations & contact')),
                'url' => '/tentang#hubungi-kami',
                'sort_order' => $order + 1,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    // ------------------------------------------------------------------ helpers

    private function pageId(string $slug): ?int
    {
        $id = DB::table('pages')->where('slug', $slug)->value('id');

        return $id ? (int) $id : null;
    }

    private function json(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE);
    }

    /** Item "Hubungi Kami" di bawah item ber-key "tentang". */
    private function contactMenuItems(string $url)
    {
        $parents = DB::table('menu_items')->where('key', 'tentang')->pluck('id');

        return DB::table('menu_items')->whereIn('parent_id', $parents)->where('url', $url)->where('label->id', 'Hubungi Kami');
    }

    private function deleteSection(string $slug, string $key, string $type): void
    {
        if ($pageId = $this->pageId($slug)) {
            DB::table('page_sections')->where('page_id', $pageId)->where('key', $key)->where('type', $type)->delete();
        }
    }

    private function insertSectionIfMissing(int $pageId, array $section, int $sortOrder): void
    {
        if (DB::table('page_sections')->where('page_id', $pageId)->where('key', $section['key'])->exists()) {
            return;
        }
        DB::table('page_sections')->insert([
            'page_id' => $pageId,
            'key' => $section['key'],
            'type' => $section['type'],
            'sort_order' => $sortOrder,
            'is_visible' => true,
            'content' => $this->json($section['content']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Timpa sebagian konten section hanya bila field->id masih persis $expected (belum disunting admin). */
    private function patchSection(int $pageId, string $key, string $field, string $expected, array $patch): void
    {
        $row = DB::table('page_sections')->where('page_id', $pageId)->where('key', $key)->first(['id', 'content']);
        if (! $row) {
            return;
        }
        $content = json_decode($row->content, true) ?: [];
        if (($content[$field]['id'] ?? null) !== $expected) {
            return;
        }
        DB::table('page_sections')->where('id', $row->id)->update([
            'content' => $this->json(array_merge($content, $patch)),
            'updated_at' => now(),
        ]);
    }

    private function replaceInPageContent(string $slug, string $search, string $replace): void
    {
        if (! ($pageId = $this->pageId($slug))) {
            return;
        }
        foreach (DB::table('page_sections')->where('page_id', $pageId)->get(['id', 'content']) as $row) {
            $updated = str_replace($search, $replace, $row->content);
            if ($updated !== $row->content) {
                DB::table('page_sections')->where('id', $row->id)->update(['content' => $updated, 'updated_at' => now()]);
            }
        }
    }
}
