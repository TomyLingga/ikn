<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

// Wilayah Kemendagri (ASUMSI A-5): satu tabel 4 level, kode bertitik ("31.75.06.1007").
// parent_code = kode tanpa segmen terakhir; tanpa FK agar impor per chunk tidak bergantung urutan.
class CreateRegionsTable extends Migration
{
    // Di luar transaksi agar CREATE EXTENSION yang gagal (tanpa hak) tidak membatalkan migrasi.
    public $withinTransaction = false;

    public function up()
    {
        Schema::create('regions', function (Blueprint $table) {
            $table->string('code', 16)->primary();
            $table->string('parent_code', 16)->nullable()->index();
            $table->string('level', 16); // Region::LEVELS
            $table->string('name', 120)->index();
        });

        // Index trigram untuk pencarian ILIKE '%...%' (opsional: butuh ekstensi pg_trgm).
        try {
            DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
            DB::statement('CREATE INDEX regions_name_trgm_index ON regions USING gin (name gin_trgm_ops)');
        } catch (\Throwable $e) {
            Log::notice('regions: pg_trgm index skipped: '.$e->getMessage());
        }
    }

    public function down()
    {
        Schema::dropIfExists('regions');
    }
}
