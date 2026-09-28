<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// FK ke orders yang ditunda BE-2 (tabel orders dibuat pada batch 3NNNNN). Baris yatim dibersihkan dulu
// agar migrasi aman dijalankan pada DB yang sudah berisi data.
class AddOrderForeignKeysToReviewsAndVoucherUsages extends Migration
{
    public function up()
    {
        DB::table('reviews')->whereNotNull('order_id')
            ->whereNotIn('order_id', fn ($q) => $q->select('id')->from('orders'))
            ->update(['order_id' => null]);
        DB::table('voucher_usages')
            ->whereNotIn('order_id', fn ($q) => $q->select('id')->from('orders'))
            ->delete();

        Schema::table('reviews', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
        });

        Schema::table('voucher_usages', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
        });
    }

    public function down()
    {
        Schema::table('voucher_usages', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
        });

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
        });
    }
}
