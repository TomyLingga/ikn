<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Pabrik asal produk (ASUMSI A-90). Null = pabrik bawaan (urutan pertama factory_locations). Baris lama sengaja tidak
// diisi: produk bisa sudah diubah admin; CatalogSeeder hanya mengisi produk baru di basis data kosong.
class AddFactoryLocationIdToProductsTable extends Migration
{
    public function up()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('factory_location_id')->nullable()->after('category_id')->constrained('factory_locations')->nullOnDelete();
        });
    }

    public function down()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('factory_location_id');
        });
    }
}
