<?php

use Database\Seeders\FactoryLocationSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Lokasi pabrik (ASUMSI A-90): menggantikan pengaturan commerce shipping_origin_* (asal ongkir per km, A-76) dan
// pickup_* (titik ambil Loco, A-85) dengan satu daftar pabrik. Pola migrasi data A-59: bila tabel kosong, dua baris
// bawaan diisi dari nilai pengaturan lama (cadangan FactoryLocationSeeder::rows()), lalu kunci lama dihapus agar tidak
// ada dua sumber kebenaran. down() menulis kembali kunci lama dari baris pabrik sebelum tabel dihapus.
class CreateFactoryLocationsTable extends Migration
{
    private const ORIGIN_KEYS = ['shipping_origin_label', 'shipping_origin_lat', 'shipping_origin_lng'];
    private const PICKUP_KEYS = ['pickup_label', 'pickup_address', 'pickup_lat', 'pickup_lng'];

    public function up()
    {
        Schema::create('factory_locations', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique(); // tanjung-morawa | sei-bamban | ...
            $table->jsonb('name'); // {id,en}
            $table->string('address', 255);
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->boolean('allows_pickup')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestampsTz();

            $table->index('sort_order');
        });

        if (DB::table('factory_locations')->count() === 0) {
            [$morawa, $bamban] = FactoryLocationSeeder::rows();

            $label = $this->setting('pickup_label');
            if (is_string($label) && trim($label) !== '') {
                $label = trim($label);
                // Nama EN bawaan hanya bila label lama masih bawaan; label buatan admin dipakai untuk kedua bahasa.
                $morawa['name'] = $label === $morawa['name']['id'] ? $morawa['name'] : ['id' => $label, 'en' => $label];
            }
            $address = $this->setting('pickup_address');
            if (is_string($address) && trim($address) !== '') {
                $morawa['address'] = mb_substr(trim($address), 0, 255);
            }
            [$morawa['lat'], $morawa['lng']] = $this->point('pickup_lat', 'pickup_lng', $morawa['lat'], $morawa['lng']);
            [$bamban['lat'], $bamban['lng']] = $this->point('shipping_origin_lat', 'shipping_origin_lng', $bamban['lat'], $bamban['lng']);

            $now = now();
            DB::table('factory_locations')->insert(array_map(fn (array $row) => [
                'code' => $row['code'],
                'name' => json_encode($row['name'], JSON_UNESCAPED_UNICODE),
                'address' => $row['address'],
                'lat' => $row['lat'],
                'lng' => $row['lng'],
                'allows_pickup' => $row['allows_pickup'],
                'sort_order' => $row['sort_order'],
                'created_at' => $now,
                'updated_at' => $now,
            ], [$morawa, $bamban]));
        }

        DB::table('settings')->whereIn('key', array_map(fn ($key) => 'commerce.'.$key, array_merge(self::ORIGIN_KEYS, self::PICKUP_KEYS)))->delete();
    }

    public function down()
    {
        $rows = DB::table('factory_locations')->orderBy('sort_order')->orderBy('id')->get()->keyBy('code');
        $morawa = $rows->get(FactoryLocationSeeder::TANJUNG_MORAWA) ?? $rows->first();
        $bamban = $rows->get(FactoryLocationSeeder::SEI_BAMBAN);
        $name = fn ($row) => json_decode($row->name, true)['id'] ?? '';
        $coord = fn ($value) => $value === null ? '' : round((float) $value, 6);

        $values = [];
        if ($morawa) {
            $values += ['pickup_label' => $name($morawa), 'pickup_address' => $morawa->address, 'pickup_lat' => $coord($morawa->lat), 'pickup_lng' => $coord($morawa->lng)];
        }
        if ($bamban) {
            $values += ['shipping_origin_label' => $name($bamban), 'shipping_origin_lat' => $coord($bamban->lat), 'shipping_origin_lng' => $coord($bamban->lng)];
        }
        $now = now();
        foreach ($values as $key => $value) {
            DB::table('settings')->updateOrInsert(
                ['key' => 'commerce.'.$key],
                ['value' => json_encode($value, JSON_UNESCAPED_UNICODE), 'group' => 'commerce', 'is_public' => false, 'created_at' => $now, 'updated_at' => $now]
            );
        }

        Schema::dropIfExists('factory_locations');
    }

    /** Nilai pengaturan commerce lama (json) atau null bila belum pernah disimpan. */
    private function setting(string $key)
    {
        $raw = DB::table('settings')->where('key', 'commerce.'.$key)->value('value');

        return $raw === null ? null : json_decode($raw, true);
    }

    /**
     * Koordinat dari pasangan pengaturan lama: belum disimpan = bawaan; disimpan kosong ('' = belum diatur) = null.
     *
     * @return array{0: float|null, 1: float|null}
     */
    private function point(string $latKey, string $lngKey, $defaultLat, $defaultLng): array
    {
        $lat = $this->setting($latKey);
        $lng = $this->setting($lngKey);
        if ($lat === null && $lng === null) {
            return [$defaultLat, $defaultLng];
        }
        if (! is_numeric($lat) || ! is_numeric($lng)) {
            return [null, null];
        }

        return [round((float) $lat, 7), round((float) $lng, 7)];
    }
}
