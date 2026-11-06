<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Bingkai media per pemakaian (A-93): titik fokus, zoom, dan rentang putar video untuk sampul berita, foto galeri,
// dan gambar produk. Section CMS menyimpan bingkai di dalam konten jsonb, jadi tidak perlu kolom.
class AddMediaFrames extends Migration
{
    public function up(): void
    {
        Schema::table('posts', fn (Blueprint $table) => $table->jsonb('cover_frame')->nullable()->after('cover_media_id'));
        Schema::table('gallery_items', fn (Blueprint $table) => $table->jsonb('frame')->nullable()->after('media_id'));
        Schema::table('product_images', fn (Blueprint $table) => $table->jsonb('frame')->nullable()->after('media_id'));
    }

    public function down(): void
    {
        Schema::table('posts', fn (Blueprint $table) => $table->dropColumn('cover_frame'));
        Schema::table('gallery_items', fn (Blueprint $table) => $table->dropColumn('frame'));
        Schema::table('product_images', fn (Blueprint $table) => $table->dropColumn('frame'));
    }
}
