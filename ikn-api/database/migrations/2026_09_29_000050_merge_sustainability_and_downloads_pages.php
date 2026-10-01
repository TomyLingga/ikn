<?php

use Database\Seeders\CmsPageSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Satu halaman per menu utama (permintaan pemilik 2026-09-29), untuk basis data yang sudah terisi:
//  - sub-halaman Keberlanjutan (sertifikat, pelanggan, reach, whistleblowing) menjadi section halaman keberlanjutan
//    (anchor = key: esg, sertifikat, pelanggan, reach, whistleblowing, wbs-form); halaman sumber dihapus;
//  - halaman unduhan menjadi section `unduhan` (brochures) di halaman bisnis; halaman sumber dihapus;
//  - halaman hub `media` dibuat (header + kartu ke Berita dan Galeri); item menu Media menunjuk /media;
//  - URL menu dan konten /keberlanjutan/<sub> -> /keberlanjutan#<sub>, /unduhan -> /bisnis#unduhan.
// Instalasi baru mendapat susunan yang sama dari CmsPageSeeder/MenuSeeder. Rute FE mengalihkan alamat lama (308).
class MergeSustainabilityAndDownloadsPages extends Migration
{
    // [halaman sumber, key sumber] => [key baru di halaman induk]
    private const SUSTAINABILITY_MOVES = [
        ['sertifikat', 'list', 'sertifikat', 'certificates'],
        ['pelanggan', 'logos', 'pelanggan', 'customer_logos'],
        ['reach', 'summary', 'reach', 'text_visual'],
        ['whistleblowing', 'info', 'whistleblowing', 'info_blocks'],
        ['whistleblowing', 'form', 'wbs-form', 'wbs_form'],
    ];

    private const URLS = [
        '/keberlanjutan/sertifikat' => '/keberlanjutan#sertifikat',
        '/keberlanjutan/pelanggan' => '/keberlanjutan#pelanggan',
        '/keberlanjutan/whistleblowing' => '/keberlanjutan#whistleblowing',
        '/keberlanjutan/reach' => '/keberlanjutan#reach',
        '/unduhan' => '/bisnis#unduhan',
    ];

    private const REMOVED_PAGES = [
        'sertifikat' => ['Sertifikat', 'Certificates', '/ Sertifikat', '/ Certificates', 'Standar yang kami pegang.', 'The standards we uphold.'],
        'pelanggan' => ['Pelanggan Kami', 'Our Customers', '/ Pelanggan Kami', '/ Our Customers', 'Dipercaya lintas industri.', 'Trusted across industries.'],
        'reach' => ['REACH Compliance', 'REACH Compliance', '/ REACH Compliance', '/ REACH Compliance', 'Aman untuk pasar Eropa.', 'Safe for the European market.'],
        'whistleblowing' => ['Whistle Blowing System', 'Whistle Blowing System', '/ Whistle Blowing System', '/ Whistle Blowing System', 'Laporkan dugaan pelanggaran.', 'Report suspected misconduct.'],
        'unduhan' => ['Unduhan', 'Downloads', '/ Unduhan', '/ Downloads', 'Brosur & dokumen.', 'Brochures & documents.'],
    ];

    public function up(): void
    {
        $t = fn (string $id, string $en) => ['id' => $id, 'en' => $en];

        // Keberlanjutan: satu halaman.
        if ($parent = $this->pageId('keberlanjutan')) {
            $template = collect(CmsPageSeeder::sustainabilitySections($t))->keyBy('key');
            $order = 0;
            foreach ($template as $key => $section) {
                $moved = null;
                foreach (self::SUSTAINABILITY_MOVES as [$sourceSlug, $sourceKey, $targetKey]) {
                    if ($targetKey === $key) {
                        $moved = [$sourceSlug, $sourceKey];
                    }
                }
                $existing = DB::table('page_sections')->where('page_id', $parent)->where('key', $key)->first(['id']);
                if (! $existing && $key === 'esg') {
                    // Pilar lama ber-key "pillars".
                    DB::table('page_sections')->where('page_id', $parent)->where('key', 'pillars')->update(['key' => 'esg']);
                    $existing = DB::table('page_sections')->where('page_id', $parent)->where('key', 'esg')->first(['id']);
                }
                if (! $existing && $moved) {
                    $this->moveSection($moved[0], $moved[1], $parent, $key);
                    $existing = DB::table('page_sections')->where('page_id', $parent)->where('key', $key)->first(['id']);
                }
                if (! $existing) {
                    $this->insertSection($parent, $section, $order);
                } else {
                    $this->addMissingKeys($existing->id, $section['content']);
                    DB::table('page_sections')->where('id', $existing->id)->update(['sort_order' => $order]);
                }
                $order++;
            }
            DB::table('page_sections')->where('page_id', $parent)->where('key', 'links')->where('type', 'link_cards')->delete();
            $this->patchSection($parent, 'reach', 'label', '/ Ringkasan', ['label' => $t('/ REACH Compliance', '/ REACH Compliance')]);
        }

        // Bisnis: unduhan menjadi section sebelum CTA.
        if ($bisnis = $this->pageId('bisnis')) {
            if (! DB::table('page_sections')->where('page_id', $bisnis)->where('key', 'unduhan')->exists()) {
                $this->moveSection('unduhan', 'list', $bisnis, 'unduhan');
            }
            $template = collect(CmsPageSeeder::businessSections($t))->keyBy('key');
            $unduhan = DB::table('page_sections')->where('page_id', $bisnis)->where('key', 'unduhan')->first(['id']);
            if (! $unduhan && isset($template['unduhan'])) {
                $this->insertSection($bisnis, $template['unduhan'], 0);
                $unduhan = DB::table('page_sections')->where('page_id', $bisnis)->where('key', 'unduhan')->first(['id']);
            }
            if ($unduhan && isset($template['unduhan'])) {
                $this->addMissingKeys($unduhan->id, $template['unduhan']['content']);
            }
            foreach (array_keys($template->all()) as $index => $key) {
                DB::table('page_sections')->where('page_id', $bisnis)->where('key', $key)->update(['sort_order' => $index]);
            }
        }

        // Media: halaman hub (hanya untuk basis data yang sudah terisi; instalasi baru mendapatnya dari seeder).
        if ($this->pageId('berita') && ! $this->pageId('media')) {
            $id = DB::table('pages')->insertGetId([
                'slug' => 'media',
                'title' => $this->json($t('Media', 'Media')),
                'status' => 'published',
                'template' => 'default',
                'seo' => $this->json(['title' => $t('Media', 'Media'), 'description' => $t('Berita, foto, dan video PT Industri Karet Nusantara.', 'News, photos, and videos of PT Industri Karet Nusantara.')]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            foreach (CmsPageSeeder::mediaSections($t) as $index => $section) {
                $this->insertSection($id, $section, $index);
            }
        }

        // Halaman sumber dihapus (section header ikut terhapus lewat cascade).
        DB::table('pages')->whereIn('slug', array_keys(self::REMOVED_PAGES))->delete();

        // Menu + konten.
        foreach (self::URLS as $old => $new) {
            DB::table('menu_items')->where('url', $old)->update(['url' => $new, 'updated_at' => now()]);
        }
        DB::table('menu_items')->whereNotNull('parent_id')->where('url', '/keberlanjutan')->update(['url' => '/keberlanjutan#esg', 'updated_at' => now()]);
        DB::table('menu_items')->where('key', 'media')->where('url', '/berita')->update(['url' => '/media', 'updated_at' => now()]);
        foreach (self::URLS as $old => $new) {
            $this->replaceInAllSections('"'.$old.'"', '"'.$new.'"');
        }
    }

    public function down(): void
    {
        $t = fn (string $id, string $en) => ['id' => $id, 'en' => $en];

        foreach (self::URLS as $old => $new) {
            $this->replaceInAllSections('"'.$new.'"', '"'.$old.'"');
        }
        DB::table('menu_items')->where('key', 'media')->where('url', '/media')->update(['url' => '/berita', 'updated_at' => now()]);
        DB::table('menu_items')->whereNotNull('parent_id')->where('url', '/keberlanjutan#esg')->update(['url' => '/keberlanjutan', 'updated_at' => now()]);
        foreach (array_flip(self::URLS) as $old => $new) {
            DB::table('menu_items')->where('url', $old)->update(['url' => $new, 'updated_at' => now()]);
        }

        // Halaman sumber dibuat ulang beserta header, lalu section dipindahkan kembali.
        foreach (self::REMOVED_PAGES as $slug => [$titleId, $titleEn, $labelId, $labelEn, $headId, $headEn]) {
            if ($this->pageId($slug)) {
                continue;
            }
            $id = DB::table('pages')->insertGetId([
                'slug' => $slug,
                'title' => $this->json($t($titleId, $titleEn)),
                'status' => 'published',
                'template' => 'default',
                'seo' => $this->json(['title' => $t($titleId, $titleEn), 'description' => $t('', '')]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->insertSection($id, ['key' => 'header', 'type' => 'page_header', 'content' => [
                'label' => $t($labelId, $labelEn), 'title' => $t($headId, $headEn), 'lead' => $t('', ''), 'breadcrumb' => true,
            ]], 0);
        }
        if ($parent = $this->pageId('keberlanjutan')) {
            foreach (self::SUSTAINABILITY_MOVES as $index => [$sourceSlug, $sourceKey, $targetKey]) {
                if ($target = $this->pageId($sourceSlug)) {
                    DB::table('page_sections')->where('page_id', $parent)->where('key', $targetKey)
                        ->update(['page_id' => $target, 'key' => $sourceKey, 'sort_order' => $index + 1, 'updated_at' => now()]);
                }
            }
            DB::table('page_sections')->where('page_id', $parent)->where('key', 'esg')->update(['key' => 'pillars']);
        }
        if (($bisnis = $this->pageId('bisnis')) && ($unduhan = $this->pageId('unduhan'))) {
            DB::table('page_sections')->where('page_id', $bisnis)->where('key', 'unduhan')
                ->update(['page_id' => $unduhan, 'key' => 'list', 'sort_order' => 1, 'updated_at' => now()]);
        }
        DB::table('pages')->where('slug', 'media')->delete();
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

    private function moveSection(string $sourceSlug, string $sourceKey, int $targetPage, string $targetKey): void
    {
        if (! ($source = $this->pageId($sourceSlug))) {
            return;
        }
        DB::table('page_sections')->where('page_id', $source)->where('key', $sourceKey)
            ->update(['page_id' => $targetPage, 'key' => $targetKey, 'updated_at' => now()]);
    }

    private function insertSection(int $pageId, array $section, int $sortOrder): void
    {
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

    /** Tambahkan kunci konten yang belum ada (mis. label/heading baru) tanpa menimpa nilai admin. */
    private function addMissingKeys(int $sectionId, array $template): void
    {
        $row = DB::table('page_sections')->where('id', $sectionId)->first(['content']);
        $content = json_decode($row->content, true) ?: [];
        $merged = $content + $template;
        if ($merged !== $content) {
            DB::table('page_sections')->where('id', $sectionId)->update(['content' => $this->json($merged), 'updated_at' => now()]);
        }
    }

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
        DB::table('page_sections')->where('id', $row->id)->update(['content' => $this->json(array_merge($content, $patch)), 'updated_at' => now()]);
    }

    private function replaceInAllSections(string $search, string $replace): void
    {
        foreach (DB::table('page_sections')->where('content', 'like', '%'.$search.'%')->get(['id', 'content']) as $row) {
            DB::table('page_sections')->where('id', $row->id)
                ->update(['content' => str_replace($search, $replace, $row->content), 'updated_at' => now()]);
        }
    }
}
