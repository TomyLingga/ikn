<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Logo/lencana sertifikat (gambar dari media library) yang tampil di section sertifikat (2026-10-03).
class AddLogoToCertificates extends Migration
{
    public function up()
    {
        Schema::table('certificates', function (Blueprint $table) {
            $table->foreignId('logo_media_id')->nullable()->after('media_id')->constrained('media')->nullOnDelete();
        });
    }

    public function down()
    {
        Schema::table('certificates', function (Blueprint $table) {
            $table->dropConstrainedForeignId('logo_media_id');
        });
    }
}
