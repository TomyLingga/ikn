<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Log webhook gateway mentah (KEPUTUSAN pembayaran): idempotensi provider+external_id+event → result duplicate.
class CreatePaymentWebhookLogsTable extends Migration
{
    public function up()
    {
        Schema::create('payment_webhook_logs', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 32);
            $table->string('event', 64)->nullable();
            $table->string('external_id', 120)->nullable();
            $table->boolean('signature_valid')->default(false);
            $table->jsonb('headers')->nullable();
            $table->jsonb('payload')->nullable();
            $table->string('result', 16); // processed|duplicate|ignored|error
            $table->string('note', 255)->nullable();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->timestampTz('created_at');
            $table->index(['provider', 'external_id', 'event']);
            $table->index('created_at');
        });
    }

    public function down()
    {
        Schema::dropIfExists('payment_webhook_logs');
    }
}
