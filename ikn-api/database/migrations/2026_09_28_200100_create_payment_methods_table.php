<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Metode pembayaran yang dikelola admin (KEPUTUSAN pembayaran). Rahasia gateway tetap di .env, bukan di config.
class CreatePaymentMethodsTable extends Migration
{
    public function up()
    {
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('type', 32); // manual_transfer|qris_static|qris_dynamic|virtual_account|ewallet
            $table->string('driver', 32)->default('manual'); // manual|xendit
            $table->jsonb('name'); // {id,en}
            $table->jsonb('instructions')->nullable(); // {id,en}
            $table->jsonb('config')->nullable(); // qrisMediaId, channelCode, bankCode, feePercent (non-rahasia)
            $table->boolean('is_active')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestampsTz();
            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('payment_methods');
    }
}
