<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Detail kartu sertifikat (2026-11-04): nomor, penerbit, akreditasi, standar acuan, dan status berlaku.
// `material` tetap dipakai sebagai kategori/jenis sertifikat.
class AddDetailsToCertificates extends Migration
{
    public function up()
    {
        Schema::table('certificates', function (Blueprint $table) {
            $table->string('number', 120)->nullable()->after('description');
            $table->string('issuer', 160)->nullable()->after('number');
            $table->string('accreditation', 120)->nullable()->after('issuer');
            $table->string('standard', 120)->nullable()->after('accreditation');
            $table->string('status', 16)->default('active')->after('standard');
        });
    }

    public function down()
    {
        Schema::table('certificates', function (Blueprint $table) {
            $table->dropColumn(['number', 'issuer', 'accreditation', 'standard', 'status']);
        });
    }
}
