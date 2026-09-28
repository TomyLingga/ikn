<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Ulasan produk (ASUMSI A-13). order_id tanpa FK keras karena tabel orders dibuat pada area BE-3 (migrasi 3NNNNN).
class CreateReviewsTable extends Migration
{
    public function up()
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('order_id')->nullable()->index();
            $table->smallInteger('rating');
            $table->text('body')->nullable();
            $table->boolean('is_published')->default(true);
            $table->timestampsTz();
            $table->index(['product_id', 'is_published', 'created_at']);
            $table->unique(['product_id', 'user_id', 'order_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('reviews');
    }
}
