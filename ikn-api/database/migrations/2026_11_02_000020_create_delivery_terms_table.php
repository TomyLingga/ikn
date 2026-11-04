<?php

use Database\Seeders\DeliveryTermSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Cara serah terima (ASUMSI A-85): master kecil yang dikelola admin modul shipping. Zona ongkir hanya dipakai
// baris ber-pricing_mode "zone" (Franco); Loco tanpa ongkir; FOB termasuk harga; CIF ditawarkan admin (Phase E5).
// Baris bawaan (Loco aktif urutan 1, Franco nonaktif, FOB Belawan, CIF) diisi di sini juga (pola migrasi data A-59):
// basis data terisi yang hanya menjalankan `migrate` harus tetap punya term aktif, kalau tidak quote/checkout 422.
// DeliveryTermSeeder memakai baris yang sama dan idempoten, jadi `migrate --seed` tidak menggandakan.
class CreateDeliveryTermsTable extends Migration
{
    public function up()
    {
        Schema::create('delivery_terms', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique(); // loco | franco | fob | cif | ...
            $table->jsonb('name'); // {id,en}
            $table->jsonb('description')->nullable(); // {id,en}
            $table->string('family', 16); // pickup | door | port
            $table->string('market', 16); // local | export
            $table->string('pricing_mode', 16); // none | zone | included | quoted
            $table->boolean('insurance_included')->default(false);
            $table->string('loading_port', 120)->nullable();
            $table->boolean('requires_destination_port')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestampsTz();

            $table->index(['market', 'is_active', 'sort_order']);
        });

        if (DB::table('delivery_terms')->count() === 0) {
            $now = now();
            DB::table('delivery_terms')->insert(array_map(fn (array $row) => [
                'code' => $row['code'],
                'name' => json_encode($row['name'], JSON_UNESCAPED_UNICODE),
                'description' => isset($row['description']) ? json_encode($row['description'], JSON_UNESCAPED_UNICODE) : null,
                'family' => $row['family'],
                'market' => $row['market'],
                'pricing_mode' => $row['pricing_mode'],
                'insurance_included' => $row['insurance_included'] ?? false,
                'loading_port' => $row['loading_port'] ?? null,
                'requires_destination_port' => $row['requires_destination_port'] ?? false,
                'is_active' => $row['is_active'] ?? true,
                'sort_order' => $row['sort_order'] ?? 0,
                'created_at' => $now,
                'updated_at' => $now,
            ], DeliveryTermSeeder::rows()));
        }
    }

    public function down()
    {
        Schema::dropIfExists('delivery_terms');
    }
}
