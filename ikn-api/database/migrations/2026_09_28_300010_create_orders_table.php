<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Order (arsitektur bagian 6 ERD + state machine 7.1). Semua nilai harga/alamat/ongkir adalah snapshot saat checkout.
// idempotency_key: header Idempotency-Key POST /customer/orders (unik per user, berlaku 24 jam di CheckoutService).
class CreateOrdersTable extends Migration
{
    public function up()
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('number', 32)->unique(); // IKN-YYYYMMDD-NNNNN (ASUMSI A-7)
            $table->string('invoice_number', 32)->nullable()->unique(); // INV/YYYY/MM/NNNNN, diisi saat paid
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 32); // pending_payment|payment_review|paid|processing|shipped|delivered|completed|cancelled|expired
            $table->string('payment_status', 32)->nullable(); // denormalisasi status payment terakhir
            $table->string('locale', 5)->default('id'); // bahasa email customer saat order dibuat
            $table->jsonb('customer_snapshot'); // {id,name,company,pic,email,phone,taxId}
            $table->jsonb('shipping_address_snapshot'); // CustomerAddress::toSnapshot()
            $table->jsonb('shipping_snapshot')->nullable(); // {rateId,zoneId,label,eta,amount,type,weightGram}
            $table->jsonb('fees_snapshot')->nullable(); // [{id,name,type,amount}]
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_total', 15, 2)->default(0);
            $table->decimal('shipping_total', 15, 2)->default(0);
            $table->decimal('fee_total', 15, 2)->default(0);
            $table->decimal('tax_total', 15, 2)->default(0);
            $table->integer('unique_code')->default(0); // ASUMSI A-9 (0 = tanpa kode unik)
            $table->decimal('grand_total', 15, 2)->default(0);
            $table->boolean('price_includes_tax')->default(true);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->string('voucher_code', 64)->nullable();
            $table->text('note')->nullable();
            $table->timestampTz('payment_due_at')->nullable();
            $table->timestampTz('reminder_sent_at')->nullable();
            $table->timestampTz('paid_at')->nullable();
            $table->timestampTz('shipped_at')->nullable();
            $table->timestampTz('delivered_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampTz('expired_at')->nullable();
            $table->text('cancel_reason')->nullable();
            $table->string('courier', 120)->nullable();
            $table->string('tracking_number', 120)->nullable();
            $table->string('idempotency_key', 80)->nullable();
            $table->timestampsTz();

            $table->index(['status', 'payment_due_at']); // orders:expire, orders:remind
            $table->index(['paid_at', 'status']); // laporan penjualan (ASUMSI A-24)
            $table->index(['user_id', 'created_at']); // daftar order customer
            $table->index(['status', 'created_at']); // daftar admin + dashboard
            $table->unique(['user_id', 'idempotency_key']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('orders');
    }
}
