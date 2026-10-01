<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Catatan perjalanan kiriman yang ditambahkan admin selama order berstatus shipped (ASUMSI A-70),
// mis. "Pesanan tiba di gudang transit Pekanbaru". Bukan transisi status: status order tetap lewat OrderStateMachine.
class CreateOrderTrackingUpdatesTable extends Migration
{
    public function up()
    {
        Schema::create('order_tracking_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('note', 255);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->index(['order_id', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('order_tracking_updates');
    }
}
