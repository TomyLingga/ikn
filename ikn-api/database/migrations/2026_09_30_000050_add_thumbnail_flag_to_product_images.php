<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Media produk kini boleh berupa foto atau video, dan admin memilih foto mana yang menjadi thumbnail (ASUMSI A-72).
// Baris lama tidak ditandai: tanpa tanda, thumbnail = foto pertama menurut urutan (perilaku sebelumnya).
class AddThumbnailFlagToProductImages extends Migration
{
    public function up()
    {
        Schema::table('product_images', function (Blueprint $table) {
            $table->boolean('is_thumbnail')->default(false);
        });
    }

    public function down()
    {
        Schema::table('product_images', function (Blueprint $table) {
            $table->dropColumn('is_thumbnail');
        });
    }
}
