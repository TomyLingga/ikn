<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Pasar per customer (ASUMSI A-86): local (IDR) atau export (USD), dikunci admin saat menyetujui akun.
// Negara (ISO 3166-1 alpha-2) dan alamat perusahaan dipakai dokumen ekspor; customer lama = lokal Indonesia.
class AddMarketToCustomerProfilesTable extends Migration
{
    public function up()
    {
        Schema::table('customer_profiles', function (Blueprint $table) {
            $table->string('market', 16)->default('local')->after('phone'); // local | export
            $table->char('country_code', 2)->default('ID')->after('market');
            $table->text('company_address')->nullable()->after('country_code');
            $table->index('market');
        });
    }

    public function down()
    {
        Schema::table('customer_profiles', function (Blueprint $table) {
            $table->dropIndex(['market']);
            $table->dropColumn(['market', 'country_code', 'company_address']);
        });
    }
}
