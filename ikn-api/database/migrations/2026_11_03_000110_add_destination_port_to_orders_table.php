<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// CIF (ASUMSI A-89): pelabuhan tujuan yang dipilih customer saat checkout (teks bebas + negara + pin peta) dan metode
// bayar yang ditunda sampai penawaran ongkir disetujui (payment baru dibuat saat accept, bukan saat checkout).
class AddDestinationPortToOrdersTable extends Migration
{
    public function up()
    {
        Schema::table('orders', function (Blueprint $table) {
            // { name, country, countryCode, lat, lng }; null untuk term tanpa pelabuhan tujuan.
            $table->jsonb('destination_port')->nullable()->after('shipping_address_snapshot');
            // { code, bankAccountId } untuk order awaiting_freight; dipakai FreightQuoteService saat penawaran diterima.
            $table->jsonb('pending_payment_method')->nullable()->after('destination_port');
        });
    }

    public function down()
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['destination_port', 'pending_payment_method']);
        });
    }
}
