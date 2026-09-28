<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Percobaan bayar per order (KEPUTUSAN pembayaran; state machine 7.2). Kolom netral-gateway.
// external_id = "{orders.number}-{payments.id}" (unik per provider; dipakai pencocokan webhook).
class CreatePaymentsTable extends Migration
{
    public function up()
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();
            $table->string('method', 64); // kode metode bayar (snapshot)
            $table->string('provider', 32); // manual|xendit
            $table->string('external_id', 120)->nullable();
            $table->decimal('amount', 15, 2);
            $table->string('status', 32); // pending|awaiting_verification|paid|rejected|expired|failed|cancelled
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('paid_at')->nullable();
            $table->jsonb('payload')->nullable(); // instruksi manual / respons gateway mentah
            $table->foreignId('bank_account_id')->nullable()->constrained('bank_accounts')->nullOnDelete();
            $table->foreignId('proof_media_id')->nullable()->constrained('media')->nullOnDelete(); // disk private
            $table->timestampTz('proof_uploaded_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('verified_at')->nullable();
            $table->text('reject_reason')->nullable();
            $table->timestampsTz();

            $table->unique(['provider', 'external_id']);
            $table->index(['order_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('payments');
    }
}
