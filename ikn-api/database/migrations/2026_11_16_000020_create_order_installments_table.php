<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Termin per order (ASUMSI A-97): salinan jadwal syarat pembayaran yang dibekukan saat total order final (checkout,
// atau saat penawaran ongkir CIF disepakati). amount decimal satuan mayor seperti kolom uang lain; jumlah semua baris
// selalu sama dengan grand_total order. Order tanpa baris di sini = satu pembayaran penuh (alur lama).
class CreateOrderInstallmentsTable extends Migration
{
    public function up()
    {
        Schema::create('order_installments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->unsignedSmallInteger('seq'); // urutan 1..n
            $table->string('key', 40);
            $table->jsonb('label'); // {id,en}
            $table->decimal('percent', 5, 2);
            $table->decimal('amount', 15, 2); // satuan mayor (USD 382.50)
            $table->char('currency', 3)->default('IDR');
            $table->string('trigger', 16); // order | shipped | delivered
            $table->unsignedInteger('due_days')->default(0);
            $table->string('status', 24); // scheduled | due | awaiting_verification | paid | void
            $table->timestampTz('due_at')->nullable();
            $table->timestampTz('billed_at')->nullable();
            $table->timestampTz('paid_at')->nullable();
            $table->timestampTz('reminded_at')->nullable();
            $table->unsignedInteger('reminder_count')->default(0);
            $table->timestampsTz();

            $table->unique(['order_id', 'seq']);
            $table->index(['status', 'due_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('order_installments');
    }
}
