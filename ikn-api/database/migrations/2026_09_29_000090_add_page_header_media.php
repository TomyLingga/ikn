<?php

use Database\Seeders\MediaSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Kepala halaman (page_header) mendapat slideshow foto/video (`media`, `interval`, `layout`). Basis data yang sudah
// terisi mendapat foto seed yang sama dengan seeder untuk halaman bawaan yang belum punya media; halaman lain
// dibiarkan (tata letak teks saja). down(): hapus ketiga field.
class AddPageHeaderMedia extends Migration
{
    private const HEADER_MEDIA = [
        'tentang' => ['kantor-direksi.png', 'pabrik-2-1.png'],
        'bisnis' => ['produksi-karet-1.webp', 'karet-1-1-scaled.jpg'],
        'keberlanjutan' => ['karet-1-1-scaled.jpg'],
        'media' => ['pabrik-2-1.png'],
        'kontak' => ['kantor-direksi.png'],
    ];

    public function up(): void
    {
        foreach (self::HEADER_MEDIA as $slug => $files) {
            $pageId = DB::table('pages')->where('slug', $slug)->value('id');
            if (! $pageId) {
                continue;
            }
            $row = DB::table('page_sections')->where('page_id', $pageId)->where('type', 'page_header')->orderBy('sort_order')->first(['id', 'content']);
            if (! $row) {
                continue;
            }
            $content = json_decode($row->content, true) ?: [];
            if (! empty($content['media'])) {
                continue;
            }
            $items = [];
            foreach ($files as $file) {
                if ($id = MediaSeeder::id($file)) {
                    $items[] = ['file' => $id, 'caption' => ['id' => '', 'en' => '']];
                }
            }
            $content['media'] = $items;
            $content['interval'] = $content['interval'] ?? 6;
            $content['layout'] = $content['layout'] ?? 'split';
            DB::table('page_sections')->where('id', $row->id)
                ->update(['content' => json_encode($content, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        foreach (DB::table('page_sections')->where('type', 'page_header')->get(['id', 'content']) as $row) {
            $content = json_decode($row->content, true) ?: [];
            unset($content['media'], $content['interval'], $content['layout']);
            DB::table('page_sections')->where('id', $row->id)
                ->update(['content' => json_encode($content, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
        }
    }
}
