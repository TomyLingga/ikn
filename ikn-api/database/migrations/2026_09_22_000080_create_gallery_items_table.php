<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateGalleryItemsTable extends Migration
{
    public function up()
    {
        Schema::create('gallery_items', function (Blueprint $table) {
            $table->id();
            $table->jsonb('title');
            $table->string('type', 16); // GalleryItem::TYPES image|video
            $table->foreignId('media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('external_url')->nullable(); // id/URL YouTube untuk video
            $table->boolean('is_published')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestampsTz();
            $table->index(['is_published', 'sort_order']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('gallery_items');
    }
}
