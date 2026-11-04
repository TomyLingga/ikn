<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Rekening USD untuk transfer manual ekspor (ASUMSI A-86): SWIFT, alamat bank, bank koresponden untuk invoice.
class AddCurrencyAndSwiftToBankAccountsTable extends Migration
{
    public function up()
    {
        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->char('currency', 3)->default('IDR')->after('account_holder');
            $table->string('swift_code', 16)->nullable()->after('currency');
            $table->string('bank_address', 255)->nullable()->after('swift_code');
            $table->string('correspondent_bank', 160)->nullable()->after('bank_address');
        });
    }

    public function down()
    {
        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->dropColumn(['currency', 'swift_code', 'bank_address', 'correspondent_bank']);
        });
    }
}
