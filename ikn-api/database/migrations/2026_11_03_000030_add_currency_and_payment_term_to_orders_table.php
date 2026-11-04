<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Mata uang order (ASUMSI A-86): kolom uang decimal(15,2) tetap dalam satuan mayor, currency menentukan satuan
// terkecil di JSON (IDR rupiah, USD sen). Syarat pembayaran ekspor (ASUMSI A-87) dibekukan sebagai snapshot.
class AddCurrencyAndPaymentTermToOrdersTable extends Migration
{
    public function up()
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->char('currency', 3)->default('IDR')->after('locale');
            $table->string('payment_term_code', 32)->nullable()->after('delivery_term');
            $table->jsonb('payment_term_snapshot')->nullable()->after('payment_term_code'); // {code, name{id,en}, description{id,en}}
            $table->index('currency');
        });
    }

    public function down()
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['currency']);
            $table->dropColumn(['currency', 'payment_term_code', 'payment_term_snapshot']);
        });
    }
}
