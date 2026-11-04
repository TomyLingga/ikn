<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Kurs USD/IDR per hari kerja dari JISDOR (BI) atau input manual admin (ASUMSI A-84). Informasi untuk
// keuangan: tidak dipakai di order, invoice, maupun laporan.
class CreateExchangeRatesTable extends Migration
{
    public function up()
    {
        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->char('currency', 3)->default('USD');
            $table->decimal('rate', 15, 2);
            $table->string('source', 16); // jisdor | manual
            $table->timestampTz('fetched_at')->nullable();
            $table->timestampsTz();
            $table->unique(['date', 'currency']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('exchange_rates');
    }
}
