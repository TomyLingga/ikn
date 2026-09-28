<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Zona ongkir + wilayah cakupan + tarif (KEPUTUSAN ongkir; ASUMSI A-16).
// region_code tanpa FK keras ke regions (tabel milik area BE-1) agar urutan migrasi antar area tidak saling mengunci.
class CreateShippingTables extends Migration
{
    public function up()
    {
        Schema::create('shipping_zones', function (Blueprint $table) {
            $table->id();
            $table->jsonb('name'); // {id,en}
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false); // zona cadangan bila alamat tidak cocok zona mana pun
            $table->integer('priority')->default(0); // lebih besar menang saat level sama
            $table->timestampsTz();
            $table->index(['is_active', 'priority']);
        });

        Schema::create('shipping_zone_regions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained('shipping_zones')->cascadeOnDelete();
            $table->string('region_code', 16); // kode Kemendagri
            $table->string('level', 16); // province|regency|district|village
            $table->timestampsTz();
            $table->unique(['zone_id', 'region_code']);
            $table->index(['region_code', 'level']);
        });

        Schema::create('shipping_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained('shipping_zones')->cascadeOnDelete();
            $table->jsonb('name'); // {id,en} label tarif ("Reguler", "Ekspres")
            $table->string('type', 16)->default('flat'); // flat|per_kg
            $table->decimal('base_amount', 15, 2)->default(0);
            $table->decimal('per_kg_amount', 15, 2)->default(0);
            $table->decimal('min_amount', 15, 2)->default(0);
            $table->decimal('free_above', 15, 2)->nullable(); // null = tidak ada gratis ongkir
            $table->jsonb('eta')->nullable(); // {id,en}
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestampsTz();
            $table->index(['zone_id', 'is_active', 'sort_order']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('shipping_rates');
        Schema::dropIfExists('shipping_zone_regions');
        Schema::dropIfExists('shipping_zones');
    }
}
