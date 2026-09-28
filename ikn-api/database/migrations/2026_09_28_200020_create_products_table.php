<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateProductsTable extends Migration
{
    public function up()
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 160)->unique();
            $table->string('code', 64)->unique();
            $table->foreignId('category_id')->constrained('categories')->restrictOnDelete();
            $table->jsonb('name'); // {id,en}
            $table->string('kind', 120)->nullable(); // "Cyclised Natural Rubber", "Rubber Articles"
            $table->jsonb('summary')->nullable(); // {id,en}
            $table->jsonb('highlights')->nullable(); // {id: string[], en: string[]}
            $table->jsonb('specs')->nullable(); // [[k,v]]
            $table->jsonb('applications')->nullable(); // {id: string[], en: string[]}
            $table->jsonb('solubility')->nullable(); // [[k,v]]
            $table->jsonb('aliases')->nullable(); // string[] untuk pencarian
            $table->string('price_mode', 16)->default('fixed'); // fixed|quote
            $table->decimal('price', 15, 2)->nullable();
            $table->decimal('promo_price', 15, 2)->nullable();
            $table->timestampTz('promo_starts_at')->nullable();
            $table->timestampTz('promo_ends_at')->nullable();
            $table->string('unit', 32)->default('pcs');
            $table->integer('moq')->default(1);
            $table->integer('weight_gram')->default(1000); // ASUMSI A-16
            $table->integer('stock_qty')->default(0); // cache dari stock_movements (hanya StockLedger)
            $table->integer('reserved_qty')->default(0); // cache dari stock_movements (hanya StockLedger)
            $table->string('stock_status', 24)->default('out_of_stock'); // in_stock|made_to_order|out_of_stock
            $table->boolean('is_taxable')->default(true); // ASUMSI A-8
            $table->boolean('is_published')->default(false);
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->integer('review_count')->default(0);
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->index(['category_id', 'is_published']);
            $table->index(['is_published', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('products');
    }
}
