<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Biaya tambahan punya mata uang (ASUMSI A-86): OrderCalculator hanya memakai fee se-mata-uang dengan order.
class AddCurrencyToFeesTable extends Migration
{
    public function up()
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->char('currency', 3)->default('IDR')->after('amount');
        });
    }

    public function down()
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->dropColumn('currency');
        });
    }
}
