<?php

use Database\Seeders\CmsPageSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Basis data yang sudah terisi (instalasi baru mendapatnya dari seeder):
//  - halaman Tentang mendapat section struktur organisasi (org_chart, anchor #struktur-organisasi) di antara
//    Visi & Misi dan Nilai AKHLAK, plus item menu "Struktur Organisasi" di bawah Tentang Kami;
//  - section Informasi kontak mendapat pin peta (`geo`) per lokasi (perkiraan dari alamat untuk dua lokasi seed) dan
//    `background` (foto latar, kosong).
class AddOrgChartAndContactGeo extends Migration
{
    private const ORDER = ['header', 'profile', 'history', 'vision-mission', 'struktur', 'values'];

    public function up(): void
    {
        $t = fn (string $id, string $en) => ['id' => $id, 'en' => $en];

        if ($tentang = $this->pageId('tentang')) {
            if (! DB::table('page_sections')->where('page_id', $tentang)->where('key', 'struktur')->exists()) {
                $section = CmsPageSeeder::orgChartSection($t);
                DB::table('page_sections')->insert([
                    'page_id' => $tentang,
                    'key' => $section['key'],
                    'type' => $section['type'],
                    'sort_order' => 4,
                    'is_visible' => true,
                    'content' => $this->json($section['content']),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            foreach (self::ORDER as $index => $key) {
                DB::table('page_sections')->where('page_id', $tentang)->where('key', $key)->update(['sort_order' => $index]);
            }
        }

        foreach (DB::table('menu_items')->where('key', 'tentang')->get(['id', 'menu_id']) as $parent) {
            $children = DB::table('menu_items')->where('parent_id', $parent->id)->orderBy('sort_order')->get(['id', 'url', 'sort_order']);
            if ($children->isEmpty() || $children->contains(fn ($c) => $c->url === '/tentang#struktur-organisasi')) {
                continue;
            }
            $after = $children->first(fn ($c) => $c->url === '/tentang#visi-misi');
            $position = $after ? (int) $after->sort_order + 1 : (int) $children->max('sort_order') + 1;
            DB::table('menu_items')->where('parent_id', $parent->id)->where('sort_order', '>=', $position)->increment('sort_order');
            DB::table('menu_items')->insert([
                'menu_id' => $parent->menu_id,
                'parent_id' => $parent->id,
                'key' => null,
                'label' => $this->json($t('Struktur Organisasi', 'Organisation Structure')),
                'description' => $this->json($t('Susunan jabatan', 'Positions and units')),
                'url' => '/tentang#struktur-organisasi',
                'sort_order' => $position,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach (DB::table('page_sections')->where('type', 'contact_info')->get(['id', 'content']) as $row) {
            $content = json_decode($row->content, true) ?: [];
            $changed = false;
            foreach ($content['locations'] ?? [] as $i => $location) {
                if (! is_array($location) || array_key_exists('geo', $location)) {
                    continue;
                }
                $name = $location['name']['id'] ?? '';
                $geo = ['lat' => null, 'lng' => null];
                if (str_starts_with($name, 'Kantor Pusat')) {
                    $geo = CmsPageSeeder::GEO_HEAD_OFFICE;
                } elseif (str_starts_with($name, 'Pabrik Resiprene')) {
                    $geo = CmsPageSeeder::GEO_RESIPRENE_PLANT;
                }
                $content['locations'][$i]['geo'] = $geo;
                $changed = true;
            }
            if (! array_key_exists('background', $content)) {
                $content['background'] = null;
                $changed = true;
            }
            if ($changed) {
                DB::table('page_sections')->where('id', $row->id)->update(['content' => $this->json($content), 'updated_at' => now()]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('page_sections')->where('type', 'contact_info')->get(['id', 'content']) as $row) {
            $content = json_decode($row->content, true) ?: [];
            foreach ($content['locations'] ?? [] as $i => $location) {
                unset($content['locations'][$i]['geo']);
            }
            unset($content['background']);
            DB::table('page_sections')->where('id', $row->id)->update(['content' => $this->json($content), 'updated_at' => now()]);
        }

        DB::table('menu_items')->where('url', '/tentang#struktur-organisasi')->delete();

        if ($tentang = $this->pageId('tentang')) {
            DB::table('page_sections')->where('page_id', $tentang)->where('key', 'struktur')->where('type', 'org_chart')->delete();
            foreach (['header', 'profile', 'history', 'vision-mission', 'values'] as $index => $key) {
                DB::table('page_sections')->where('page_id', $tentang)->where('key', $key)->update(['sort_order' => $index]);
            }
        }
    }

    private function pageId(string $slug): ?int
    {
        $id = DB::table('pages')->where('slug', $slug)->value('id');

        return $id ? (int) $id : null;
    }

    private function json(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE);
    }
}
