<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Live chat (ASUMSI A-99): edit/tarik pesan dalam batas waktu, sinkron perubahan lewat penghitung revisi per
// percakapan, dan arsip percakapan oleh admin. Tidak ada baris yang dihapus: pesan yang ditarik tetap tersimpan
// (retracted_at), isi sebelum diedit disimpan di edit_history, percakapan hanya ditandai archived_at.
class AddEditRetractArchiveToChatTables extends Migration
{
    public function up()
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            // Naik satu tiap kirim/edit/tarik; klien polling mengirim revisi terakhirnya untuk meminta perubahan.
            $table->unsignedBigInteger('revision')->default(0);
            $table->timestampTz('archived_at')->nullable();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->index('archived_at');
        });

        Schema::table('chat_messages', function (Blueprint $table) {
            $table->unsignedBigInteger('revision')->default(0); // revisi percakapan saat pesan terakhir berubah
            $table->timestampTz('edited_at')->nullable();
            $table->timestampTz('retracted_at')->nullable();
            $table->jsonb('edit_history')->nullable(); // [{body, at}] isi sebelum tiap edit; tidak pernah keluar lewat API
            $table->index(['conversation_id', 'revision']);
        });
    }

    public function down()
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropIndex(['conversation_id', 'revision']);
            $table->dropColumn(['revision', 'edited_at', 'retracted_at', 'edit_history']);
        });

        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropIndex(['archived_at']);
            $table->dropConstrainedForeignId('archived_by');
            $table->dropColumn(['revision', 'archived_at']);
        });
    }
}
