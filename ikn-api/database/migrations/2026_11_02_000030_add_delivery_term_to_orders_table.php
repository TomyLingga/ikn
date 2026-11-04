<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// orders.delivery_term = kode baris delivery_terms saat checkout (ASUMSI A-85). Order lama semuanya diantar
// dengan tarif zona, jadi diisi "franco".
class AddDeliveryTermToOrdersTable extends Migration
{
    public function up()
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('delivery_term', 32)->nullable()->after('shipping_snapshot');
            $table->index('delivery_term');
        });

        DB::table('orders')->whereNull('delivery_term')->update(['delivery_term' => 'franco']);
    }

    public function down()
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['delivery_term']);
            $table->dropColumn('delivery_term');
        });
    }
}
