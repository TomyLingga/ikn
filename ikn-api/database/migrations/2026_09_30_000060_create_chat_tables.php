<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Live chat customer ↔ admin (ASUMSI A-73): satu percakapan per customer, pesan teks dengan rujukan produk/order opsional.
// Penghitung belum-dibaca disimpan di percakapan (murah untuk badge); pembaruan lewat polling, tanpa websocket.
class CreateChatTables extends Migration
{
    public function up()
    {
        Schema::create('chat_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete(); // customer
            $table->unsignedInteger('customer_unread')->default(0); // pesan admin yang belum dibaca customer
            $table->unsignedInteger('admin_unread')->default(0); // pesan customer yang belum dibaca admin
            $table->string('last_message_preview', 160)->nullable();
            $table->string('last_sender_role', 16)->nullable(); // customer|admin
            $table->timestampTz('last_message_at')->nullable();
            $table->timestampsTz();
            $table->index('last_message_at');
        });

        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('chat_conversations')->cascadeOnDelete();
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('sender_role', 16); // customer|admin
            $table->text('body');
            $table->jsonb('context')->nullable(); // {type:product, slug, name, image} | {type:order, number}
            $table->timestampsTz();
            $table->index(['conversation_id', 'id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('chat_messages');
        Schema::dropIfExists('chat_conversations');
    }
}
