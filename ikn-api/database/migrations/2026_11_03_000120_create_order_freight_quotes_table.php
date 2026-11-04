<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Penawaran ongkir CIF per order (ASUMSI A-89): satu baris per putaran (admin menawar, customer membalas), rincian
// baris jsonb [{label, amount}] dalam satuan terkecil mata uang order, total decimal satuan mayor seperti kolom uang
// lain. Hanya satu penawaran per order yang boleh berstatus accepted (indeks unik parsial).
class CreateOrderFreightQuotesTable extends Migration
{
    public function up()
    {
        Schema::create('order_freight_quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->unsignedInteger('round');
            $table->string('proposed_by', 16); // admin | customer
            $table->jsonb('lines'); // [{ label, amount }] amount = satuan terkecil mata uang order
            $table->decimal('total', 15, 2); // satuan mayor (USD 1850.00)
            $table->text('note')->nullable();
            $table->timestampTz('valid_until')->nullable();
            $table->string('status', 16); // proposed | accepted | rejected | superseded | expired
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('responded_at')->nullable();
            $table->timestampsTz();

            $table->index(['order_id', 'round']);
            $table->index(['status', 'valid_until']);
        });

        DB::statement("CREATE UNIQUE INDEX order_freight_quotes_one_accepted ON order_freight_quotes (order_id) WHERE status = 'accepted'");
    }

    public function down()
    {
        Schema::dropIfExists('order_freight_quotes');
    }
}
