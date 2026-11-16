<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Percobaan bayar per termin (ASUMSI A-97): payment milik satu termin order; null = order tanpa termin (alur lama,
// satu pembayaran sebesar grand total).
class AddInstallmentIdToPaymentsTable extends Migration
{
    public function up()
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('installment_id')->nullable()->after('order_id')->constrained('order_installments')->nullOnDelete();
            $table->index('installment_id');
        });
    }

    public function down()
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['installment_id']);
            $table->dropIndex(['installment_id']);
            $table->dropColumn('installment_id');
        });
    }
}
