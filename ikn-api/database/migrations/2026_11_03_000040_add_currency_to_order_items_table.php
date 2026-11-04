<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Mata uang item mengikuti order (turunan, disalin saat checkout) agar baris item bisa dibaca sendiri (ASUMSI A-86).
class AddCurrencyToOrderItemsTable extends Migration
{
    public function up()
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->char('currency', 3)->default('IDR')->after('qty');
        });
    }

    public function down()
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('currency');
        });
    }
}
