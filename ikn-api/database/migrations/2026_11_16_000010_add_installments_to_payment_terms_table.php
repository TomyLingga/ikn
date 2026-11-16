<?php

use Database\Seeders\PaymentTermSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Pembayaran bertahap / termin (ASUMSI A-97): jadwal termin di syarat pembayaran. Kosong = satu pembayaran penuh
// seperti sebelumnya. Baris: { key, label {id,en}, percent, trigger order|shipped|delivered, dueDays }.
// Baris bawaan tt_30_70 diberi jadwal 30% saat pesanan dibuat + 70% saat barang dimuat ke kapal (pola migrasi data
// A-59); syarat yang jadwalnya sudah diisi admin tidak ditimpa.
class AddInstallmentsToPaymentTermsTable extends Migration
{
    public function up()
    {
        Schema::table('payment_terms', function (Blueprint $table) {
            $table->jsonb('installments')->nullable()->after('description');
        });

        foreach (PaymentTermSeeder::rows() as $row) {
            if (empty($row['installments'])) {
                continue;
            }
            DB::table('payment_terms')->where('code', $row['code'])->whereNull('installments')->update([
                'installments' => json_encode($row['installments'], JSON_UNESCAPED_UNICODE),
            ]);
        }
    }

    public function down()
    {
        Schema::table('payment_terms', function (Blueprint $table) {
            $table->dropColumn('installments');
        });
    }
}
