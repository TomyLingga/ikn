<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Harga USD per satuan (basis FOB Belawan, ASUMSI A-86). Null = produk belum bisa dipesan customer ekspor.
// decimal(15,2) dalam satuan mayor (12.50 = USD 12,50); JSON memakai sen (1250).
class AddPriceUsdToProductsTable extends Migration
{
    public function up()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('price_usd', 15, 2)->nullable()->after('promo_price');
        });
    }

    public function down()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('price_usd');
        });
    }
}
