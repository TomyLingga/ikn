<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Pajak mengikuti cara serah terima, bukan mata uang (keputusan "Ekspor dan serah terima", ASUMSI A-86):
// domestic = setting tax_rate (PPN), export = setting export_tax_rate (bawaan 0). Baris bawaan FOB/CIF menjadi export
// (pola migrasi data A-59) agar basis data terisi tidak memajaki order ekspor dengan PPN.
class AddTaxProfileToDeliveryTermsTable extends Migration
{
    public function up()
    {
        Schema::table('delivery_terms', function (Blueprint $table) {
            $table->string('tax_profile', 16)->default('domestic')->after('pricing_mode'); // domestic | export
        });

        DB::table('delivery_terms')->whereIn('code', ['fob', 'cif'])->update(['tax_profile' => 'export']);
    }

    public function down()
    {
        Schema::table('delivery_terms', function (Blueprint $table) {
            $table->dropColumn('tax_profile');
        });
    }
}
