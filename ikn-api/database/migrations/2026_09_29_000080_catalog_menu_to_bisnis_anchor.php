<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Opsi pemilik 2026-09-29: item menu "Katalog Produk" di bawah Bisnis menuju blok produk halaman Bisnis
// (/bisnis#produk); tombol di blok itu membawa ke toko (/catalog). Toko sendiri tetap di /catalog.
class CatalogMenuToBisnisAnchor extends Migration
{
    public function up(): void
    {
        $this->catalogItems('/catalog')->update([
            'url' => '/bisnis#produk',
            'description' => json_encode(['id' => 'Produk kami & pemesanan online', 'en' => 'Our products & online ordering'], JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        $this->catalogItems('/bisnis#produk')->update([
            'url' => '/catalog',
            'description' => json_encode(['id' => 'Belanja & lihat semua produk', 'en' => 'Shop & browse all products'], JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ]);
    }

    /** Anak item ber-key "bisnis" dengan URL tertentu. */
    private function catalogItems(string $url)
    {
        $parents = DB::table('menu_items')->where('key', 'bisnis')->pluck('id');

        return DB::table('menu_items')->whereIn('parent_id', $parents)->where('url', $url);
    }
}
