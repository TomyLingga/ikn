<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Section text_visual mendapat field `image_side` (right|left). Di halaman Bisnis bawaan, lini kedua
// (key barang-karet) dipindah ke kiri agar dua lini bisnis berselang-seling, sama dengan seeder.
// Hanya section yang belum punya nilai `image_side` yang diubah. down(): kembalikan ke kosong (= kanan).
class AlternateBisnisTextVisualSide extends Migration
{
    public function up(): void
    {
        $row = $this->section();
        if (! $row) {
            return;
        }
        $content = json_decode($row->content, true) ?: [];
        if (! empty($content['image_side'])) {
            return;
        }
        $content['image_side'] = 'left';
        $this->save($row->id, $content);
    }

    public function down(): void
    {
        $row = $this->section();
        if (! $row) {
            return;
        }
        $content = json_decode($row->content, true) ?: [];
        if (($content['image_side'] ?? '') === 'left') {
            $content['image_side'] = '';
            $this->save($row->id, $content);
        }
    }

    private function section(): ?object
    {
        $pageId = DB::table('pages')->where('slug', 'bisnis')->value('id');
        if (! $pageId) {
            return null;
        }

        return DB::table('page_sections')
            ->where('page_id', $pageId)
            ->where('type', 'text_visual')
            ->where('key', 'barang-karet')
            ->first(['id', 'content']);
    }

    private function save(int $id, array $content): void
    {
        DB::table('page_sections')->where('id', $id)
            ->update(['content' => json_encode($content, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
    }
}
