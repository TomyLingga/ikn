<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Dokumen ekspor (ASUMSI A-88): data proforma invoice per order yang bisa diedit admin dengan nomor tetap + revisi,
// dan data kapal/B/L yang dicatat saat order term pelabuhan (FOB/CIF) berstatus shipped.
class CreateOrderProformasTable extends Migration
{
    public function up()
    {
        Schema::create('order_proformas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders')->cascadeOnDelete();
            $table->unsignedInteger('revision')->default(1);
            $table->string('vessel_name', 120)->nullable();
            $table->string('voyage', 60)->nullable();
            $table->date('etd')->nullable();
            $table->date('eta')->nullable();
            $table->string('port_of_loading', 120)->nullable();
            $table->string('port_of_discharge', 120)->nullable();
            $table->text('payment_terms')->nullable();
            $table->text('notes')->nullable();
            $table->date('valid_until')->nullable();
            $table->timestampTz('issued_at');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });

        Schema::table('orders', function (Blueprint $table) {
            // {vessel, voyage, blNumber, blDate} saat shipped on board; null untuk order darat/Loco.
            $table->jsonb('shipment_details')->nullable()->after('tracking_number');
        });
    }

    public function down()
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('shipment_details');
        });
        Schema::dropIfExists('order_proformas');
    }
}
