<?php

use Database\Seeders\PaymentTermSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Syarat pembayaran ekspor (ASUMSI A-87): master kecil yang dikelola admin, dipilih customer ekspor saat checkout,
// dibekukan ke orders.payment_term_snapshot dan dicetak di proforma/invoice (Phase E4). Informasi: aplikasi tetap
// menerima satu pembayaran sebesar grand total. Baris bawaan diisi di sini juga (pola migrasi data A-59) agar basis
// data terisi yang hanya menjalankan `migrate` sudah punya pilihan; PaymentTermSeeder memakai baris yang sama.
class CreatePaymentTermsTable extends Migration
{
    public function up()
    {
        Schema::create('payment_terms', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique(); // tt_advance | tt_30_70 | ...
            $table->jsonb('name'); // {id,en}
            $table->jsonb('description')->nullable(); // {id,en}
            $table->string('market', 16)->default('export'); // local | export
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestampsTz();

            $table->index(['market', 'is_active', 'sort_order']);
        });

        if (DB::table('payment_terms')->count() === 0) {
            $now = now();
            DB::table('payment_terms')->insert(array_map(fn (array $row) => [
                'code' => $row['code'],
                'name' => json_encode($row['name'], JSON_UNESCAPED_UNICODE),
                'description' => isset($row['description']) ? json_encode($row['description'], JSON_UNESCAPED_UNICODE) : null,
                'market' => $row['market'] ?? 'export',
                'is_active' => $row['is_active'] ?? true,
                'sort_order' => $row['sort_order'] ?? 0,
                'created_at' => $now,
                'updated_at' => $now,
            ], PaymentTermSeeder::rows()));
        }
    }

    public function down()
    {
        Schema::dropIfExists('payment_terms');
    }
}
