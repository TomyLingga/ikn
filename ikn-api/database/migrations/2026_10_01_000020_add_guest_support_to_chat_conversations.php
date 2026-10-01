<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Live chat untuk pengunjung yang belum login (ASUMSI A-73 diperluas): percakapan tanpa user_id dikenali lewat
// guest_token (acak, disimpan di browser tamu) dengan identitas yang diisi pada formulir awal.
// Perubahan NOT NULL lewat SQL mentah karena proyek tidak memakai doctrine/dbal.
class AddGuestSupportToChatConversations extends Migration
{
    public function up()
    {
        DB::statement('ALTER TABLE chat_conversations ALTER COLUMN user_id DROP NOT NULL');
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->string('guest_token', 64)->nullable()->unique();
            $table->string('guest_name', 120)->nullable();
            $table->string('guest_email', 160)->nullable();
            $table->string('guest_phone', 40)->nullable();
        });
    }

    public function down()
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropUnique(['guest_token']);
            $table->dropColumn(['guest_token', 'guest_name', 'guest_email', 'guest_phone']);
        });
        // Percakapan tamu tidak punya user_id: hapus dulu agar NOT NULL bisa dipulihkan.
        DB::table('chat_conversations')->whereNull('user_id')->delete();
        DB::statement('ALTER TABLE chat_conversations ALTER COLUMN user_id SET NOT NULL');
    }
}
