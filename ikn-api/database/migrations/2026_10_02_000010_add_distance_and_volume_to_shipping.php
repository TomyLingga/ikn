<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Ongkir tiga parameter (ASUMSI A-76): jarak (km dari titik asal gudang ke titik peta alamat), berat (kg), volume (m³).
// Dimensi kemasan produk per satuan jual untuk menghitung volume; tarif tipe "per_kg" menjadi "calculated".
class AddDistanceAndVolumeToShipping extends Migration
{
    public function up()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('length_cm', 8, 1)->nullable()->after('weight_gram');
            $table->decimal('width_cm', 8, 1)->nullable()->after('length_cm');
            $table->decimal('height_cm', 8, 1)->nullable()->after('width_cm');
        });

        Schema::table('shipping_rates', function (Blueprint $table) {
            $table->decimal('per_km_amount', 15, 2)->default(0)->after('per_kg_amount');
            $table->decimal('per_m3_amount', 15, 2)->default(0)->after('per_km_amount');
        });

        DB::table('shipping_rates')->where('type', 'per_kg')->update(['type' => 'calculated']);
    }

    public function down()
    {
        DB::table('shipping_rates')->where('type', 'calculated')->update(['type' => 'per_kg']);

        Schema::table('shipping_rates', function (Blueprint $table) {
            $table->dropColumn(['per_km_amount', 'per_m3_amount']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['length_cm', 'width_cm', 'height_cm']);
        });
    }
}
