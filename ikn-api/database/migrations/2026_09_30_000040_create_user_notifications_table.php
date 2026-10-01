<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Notifikasi dalam aplikasi untuk customer (lonceng di portal): update pesanan, pembayaran, status akun, voucher.
// Judul dan isi disimpan dua bahasa saat dibuat; `url` = path FE tujuan ketika notifikasi diklik. ASUMSI A-71.
class CreateUserNotificationsTable extends Migration
{
    public function up()
    {
        Schema::create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 64); // order.shipped, order.tracking, payment.rejected, account.approved, voucher.assigned, ...
            $table->jsonb('title'); // {id,en}
            $table->jsonb('body'); // {id,en}
            $table->string('url', 255)->nullable();
            $table->jsonb('data')->nullable();
            $table->timestampTz('read_at')->nullable();
            $table->timestampsTz();
            $table->index(['user_id', 'read_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('user_notifications');
    }
}
