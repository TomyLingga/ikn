<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Ledger stok (KEPUTUSAN stok & reservasi): satu-satunya sumber kebenaran stok; ditulis hanya oleh StockLedger.
class CreateStockMovementsTable extends Migration
{
    public function up()
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('type', 16); // in|adjust|reserve|release|commit
            $table->integer('qty'); // bertanda (lihat arsitektur bagian 8)
            $table->string('reference_type', 64)->nullable(); // "order"
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('idempotency_key', 120)->nullable()->unique(); // order:{id}:{type}:{product_id}
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at');
            $table->index(['product_id', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('stock_movements');
    }
}
