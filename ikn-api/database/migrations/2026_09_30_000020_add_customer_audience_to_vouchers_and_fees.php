<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Voucher dan biaya tambahan dapat ditujukan ke customer tertentu (ASUMSI A-67).
// audience = all (semua customer) | customers (hanya yang terdaftar di tabel pivot).
// Kolom eksplisit, bukan "pivot kosong = semua", agar voucher khusus tidak berubah menjadi umum
// ketika customer terakhirnya dihapus.
class AddCustomerAudienceToVouchersAndFees extends Migration
{
    public function up()
    {
        Schema::table('vouchers', function (Blueprint $table) {
            $table->string('audience', 16)->default('all');
        });
        Schema::table('fees', function (Blueprint $table) {
            $table->string('audience', 16)->default('all');
        });

        Schema::create('voucher_customers', function (Blueprint $table) {
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->primary(['voucher_id', 'user_id']);
            $table->index('user_id');
        });

        Schema::create('fee_customers', function (Blueprint $table) {
            $table->foreignId('fee_id')->constrained('fees')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->primary(['fee_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('fee_customers');
        Schema::dropIfExists('voucher_customers');
        Schema::table('fees', function (Blueprint $table) {
            $table->dropColumn('audience');
        });
        Schema::table('vouchers', function (Blueprint $table) {
            $table->dropColumn('audience');
        });
    }
}
