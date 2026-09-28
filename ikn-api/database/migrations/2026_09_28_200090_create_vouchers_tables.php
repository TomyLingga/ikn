<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Voucher + pemakaian per order (KEPUTUSAN diskon; ASUMSI A-23 scope kategori).
// voucher_usages.order_id tanpa FK keras karena tabel orders dibuat pada area BE-3.
class CreateVouchersTables extends Migration
{
    public function up()
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('type', 16); // percent|fixed
            $table->decimal('value', 15, 2); // persen (0-100) atau nominal rupiah
            $table->decimal('min_subtotal', 15, 2)->default(0);
            $table->decimal('max_discount', 15, 2)->nullable();
            $table->integer('quota')->nullable(); // null = tanpa batas
            $table->integer('used_count')->default(0);
            $table->integer('per_user_limit')->nullable(); // null = tanpa batas
            $table->jsonb('scope'); // {"type":"all"} | {"type":"category","categoryIds":[1,2]}
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->index(['is_active', 'starts_at', 'ends_at']);
        });

        Schema::create('voucher_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('order_id')->unique(); // satu voucher per order; idempotensi reserve
            $table->string('status', 16); // reserved|committed|released
            $table->timestampsTz();
            $table->index(['voucher_id', 'user_id', 'status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('voucher_usages');
        Schema::dropIfExists('vouchers');
    }
}
