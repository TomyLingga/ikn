<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Mata uang payment (= order) dan catatan verifikasi admin untuk transfer luar negeri (ASUMSI A-86):
// jumlah yang benar-benar diterima dan biaya bank per transaksi. Informasi; admin tetap memutuskan terima/tolak.
class AddCurrencyAndReceivedFieldsToPaymentsTable extends Migration
{
    public function up()
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->char('currency', 3)->default('IDR')->after('amount');
            $table->decimal('received_amount', 15, 2)->nullable()->after('currency');
            $table->decimal('bank_charges', 15, 2)->nullable()->after('received_amount');
            $table->string('received_note', 255)->nullable()->after('bank_charges');
        });
    }

    public function down()
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['currency', 'received_amount', 'bank_charges', 'received_note']);
        });
    }
}
