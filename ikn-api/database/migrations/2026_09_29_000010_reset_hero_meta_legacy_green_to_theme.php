<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Tema situs kini biru-putih dan warnanya diatur lewat Pengaturan Situs (theme.*). Label meta hero yang dulu
// dimigrasi dari gaya "green" ke hex hijau #8fd1a6 diubah ke '' (ikut warna tema). Indeks yang diubah dicatat di
// content._legacy_green_meta agar down() dapat memulihkannya; penanda itu diabaikan FE dan hilang saat admin
// menyimpan ulang section (normalisasi registry).
class ResetHeroMetaLegacyGreenToTheme extends Migration
{
    private const LEGACY_GREEN = '#8fd1a6';
    private const MARKER = '_legacy_green_meta';

    public function up(): void
    {
        foreach (DB::table('page_sections')->where('type', 'hero')->get(['id', 'content']) as $row) {
            $content = json_decode($row->content, true) ?: [];
            $meta = $content['meta'] ?? null;
            if (! is_array($meta)) {
                continue;
            }

            $changed = [];
            foreach ($meta as $index => $item) {
                if (is_array($item) && strtolower((string) ($item['color'] ?? '')) === self::LEGACY_GREEN) {
                    $meta[$index]['color'] = '';
                    $changed[] = $index;
                }
            }

            if ($changed) {
                $content['meta'] = $meta;
                $content[self::MARKER] = $changed;
                DB::table('page_sections')->where('id', $row->id)
                    ->update(['content' => json_encode($content, JSON_UNESCAPED_UNICODE)]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('page_sections')->where('type', 'hero')->get(['id', 'content']) as $row) {
            $content = json_decode($row->content, true) ?: [];
            $changed = $content[self::MARKER] ?? null;
            if (! is_array($changed)) {
                continue;
            }

            foreach ($changed as $index) {
                if (isset($content['meta'][$index]) && is_array($content['meta'][$index]) && ($content['meta'][$index]['color'] ?? '') === '') {
                    $content['meta'][$index]['color'] = self::LEGACY_GREEN;
                }
            }
            unset($content[self::MARKER]);

            DB::table('page_sections')->where('id', $row->id)
                ->update(['content' => json_encode($content, JSON_UNESCAPED_UNICODE)]);
        }
    }
}
