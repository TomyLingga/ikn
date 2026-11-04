<?php

namespace Tests\Feature\Catalog;

use App\Models\FactoryLocation;
use App\Models\Order;
use App\Models\Setting;
use App\Models\UserNotification;
use App\Services\Commerce\CommerceSettings;
use Database\Seeders\FactoryLocationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Lokasi pabrik (kontrak 11.8, ASUMSI A-90): migrasi data dari pengaturan lama, CRUD admin modul shipping + 409,
// GET /commerce/config `factories`, pabrik asal produk, ongkir Franco per pabrik di snapshot, Loco multi titik ambil.
class FactoryLocationTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    private const URL = '/api/v1/admin/factory-locations';

    public function test_migration_creates_two_factories_with_old_coordinates_and_drops_old_settings(): void
    {
        $rows = FactoryLocation::orderBy('sort_order')->get();
        $this->assertSame(['tanjung-morawa', 'sei-bamban'], $rows->pluck('code')->all());
        $this->assertSame([1, 2], $rows->pluck('sort_order')->all());
        $this->assertSame('Pabrik Tanjung Morawa', $rows[0]->name['id']);
        $this->assertSame([3.5387, 98.7467], [$rows[0]->latitude(), $rows[0]->longitude()]);
        $this->assertSame('Pabrik Resiprene Sei Bamban', $rows[1]->name['id']);
        $this->assertSame('Resiprene Factory Sei Bamban', $rows[1]->name['en']);
        $this->assertStringContainsString('Serdang Bedagai 20695', $rows[1]->address);
        $this->assertSame([3.3495, 99.0862], [$rows[1]->latitude(), $rows[1]->longitude()]);
        $this->assertTrue($rows[0]->allows_pickup && $rows[1]->allows_pickup);
        $this->assertArrayNotHasKey('pickup_lat', app(CommerceSettings::class)->all());
        $this->assertArrayNotHasKey('shipping_origin_lat', app(CommerceSettings::class)->all());

        // Seeder memakai baris yang sama dan idempoten.
        (new FactoryLocationSeeder)->run();
        $this->assertSame(2, FactoryLocation::count());
    }

    public function test_migration_carries_values_saved_in_old_settings(): void
    {
        $productColumn = $this->migration('2026_11_04_000020_add_factory_location_id_to_products_table.php', 'AddFactoryLocationIdToProductsTable');
        $table = $this->migration('2026_11_04_000010_create_factory_locations_table.php', 'CreateFactoryLocationsTable');
        $productColumn->down();
        $table->down();
        // down() menulis ulang kunci lama dari baris pabrik.
        $this->assertSame('Pabrik Tanjung Morawa', Setting::find('commerce.pickup_label')->value);
        $this->assertEquals(3.3495, Setting::find('commerce.shipping_origin_lat')->value);

        // Basis data lama: admin mengganti label titik ambil, mengosongkan pin, dan memindahkan titik asal ongkir.
        Setting::putValue('commerce.pickup_label', 'Gudang Ambil Medan', 'commerce');
        Setting::putValue('commerce.pickup_address', 'Jl. Yos Sudarso Km 8,5, Medan', 'commerce');
        Setting::putValue('commerce.pickup_lat', '', 'commerce');
        Setting::putValue('commerce.pickup_lng', '', 'commerce');
        Setting::putValue('commerce.shipping_origin_lat', 3.4, 'commerce');
        Setting::putValue('commerce.shipping_origin_lng', 99.1, 'commerce');
        $table->up();
        $productColumn->up();

        $rows = FactoryLocation::orderBy('sort_order')->get();
        $this->assertSame(['tanjung-morawa', 'sei-bamban'], $rows->pluck('code')->all());
        $this->assertSame(['id' => 'Gudang Ambil Medan', 'en' => 'Gudang Ambil Medan'], $rows[0]->name);
        $this->assertSame('Jl. Yos Sudarso Km 8,5, Medan', $rows[0]->address);
        $this->assertNull($rows[0]->lat);
        $this->assertNull($rows[0]->lng);
        $this->assertSame([3.4, 99.1], [$rows[1]->latitude(), $rows[1]->longitude()]);
        $this->assertSame(0, DB::table('settings')->where('key', 'like', 'commerce.pickup_%')->orWhere('key', 'like', 'commerce.shipping_origin_%')->count());
    }

    public function test_shipping_admin_crud_with_validation_and_conflicts(): void
    {
        $admin = $this->adminWith(['shipping']);
        $this->actingAs($this->adminWith(['orders']))->getJson(self::URL)->assertForbidden();

        $this->actingAs($admin)->getJson(self::URL)->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.code', 'tanjung-morawa')
            ->assertJsonPath('data.0.isDefault', true)
            ->assertJsonPath('data.0.allowsPickup', true)
            ->assertJsonPath('data.0.productsCount', 0)
            ->assertJsonPath('data.1.code', 'sei-bamban')
            ->assertJsonPath('data.1.isDefault', false)
            ->assertJsonPath('data.1.lat', 3.3495);

        $created = $this->actingAs($admin)->postJson(self::URL, [
            'code' => ' Gudang-Belawan ', 'name' => ['id' => 'Gudang Belawan'], 'address' => '  Jl. Pelabuhan   Belawan ',
            'lat' => 3.78123456, 'lng' => 98.6942, 'allowsPickup' => false,
        ])->assertStatus(201)
            ->assertJsonPath('data.code', 'gudang-belawan')
            ->assertJsonPath('data.name.en', 'Gudang Belawan')
            ->assertJsonPath('data.address', 'Jl. Pelabuhan Belawan')
            ->assertJsonPath('data.lat', 3.781235)
            ->assertJsonPath('data.allowsPickup', false)
            ->assertJsonPath('data.sortOrder', 3)
            ->assertJsonPath('data.isDefault', false)
            ->json('data.id');

        // Validasi: kode ganda/bukan slug, nama id + alamat wajib, lat/lng berpasangan dan dalam rentang.
        $this->actingAs($admin)->postJson(self::URL, ['code' => 'sei-bamban', 'name' => ['id' => 'X'], 'address' => 'Y'])
            ->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->actingAs($admin)->postJson(self::URL, ['code' => 'Pabrik Baru', 'name' => ['en' => 'Only EN'], 'address' => '', 'lat' => 3.1])
            ->assertStatus(422)->assertJsonValidationErrors(['code', 'name.id', 'address', 'lng']);
        $this->actingAs($admin)->postJson(self::URL, ['code' => 'jauh', 'name' => ['id' => 'X'], 'address' => 'Y', 'lat' => 91, 'lng' => 181])
            ->assertStatus(422)->assertJsonValidationErrors(['lat', 'lng']);

        // Ubah: kode tetap; pin boleh dikosongkan berdua.
        $this->actingAs($admin)->putJson(self::URL.'/'.$created, [
            'code' => 'gudang-belawan', 'name' => ['id' => 'Gudang Belawan', 'en' => 'Belawan Warehouse'], 'address' => 'Belawan',
            'lat' => null, 'lng' => null, 'allowsPickup' => true, 'sortOrder' => 0,
        ])->assertOk()->assertJsonPath('data.name.en', 'Belawan Warehouse')->assertJsonPath('data.lat', null)
            ->assertJsonPath('data.allowsPickup', true)->assertJsonPath('data.isDefault', true);
        $this->actingAs($admin)->putJson(self::URL.'/'.$created, ['code' => 'lain', 'name' => ['id' => 'X'], 'address' => 'Y'])
            ->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->assertSame('gudang-belawan', FactoryLocation::find($created)->code);

        // Hapus: ditolak bila masih dipakai produk, juga baris terakhir.
        $bamban = FactoryLocation::where('code', 'sei-bamban')->firstOrFail();
        $product = $this->makeProduct(['factory_location_id' => $bamban->id]);
        $this->actingAs($admin)->getJson(self::URL)->assertJsonPath('data.2.code', 'sei-bamban')->assertJsonPath('data.2.productsCount', 1);
        $this->actingAs($admin)->deleteJson(self::URL.'/'.$bamban->id)->assertStatus(409)->assertJsonPath('code', 'FACTORY_LOCATION_IN_USE');
        $product->update(['factory_location_id' => null]);
        $this->actingAs($admin)->deleteJson(self::URL.'/'.$bamban->id)->assertOk();
        $this->actingAs($admin)->deleteJson(self::URL.'/'.$created)->assertOk();
        $last = FactoryLocation::firstOrFail();
        $this->actingAs($admin)->deleteJson(self::URL.'/'.$last->id)->assertStatus(409)->assertJsonPath('code', 'FACTORY_LOCATION_IN_USE');
        $this->assertSame(1, FactoryLocation::count());
    }

    // Faktor jalan tetap bisa diubah admin shipping (sumber tunggal: setting commerce shipping_road_factor).
    public function test_shipping_admin_manages_road_factor_used_by_distance(): void
    {
        $url = '/api/v1/admin/shipping/road-factor';
        $admin = $this->adminWith(['shipping']);
        $this->actingAs($this->adminWith(['orders']))->getJson($url)->assertForbidden();
        $this->actingAs($this->adminWith(['orders']))->putJson($url, ['roadFactor' => 2])->assertForbidden();

        $this->actingAs($admin)->getJson($url)->assertOk()->assertExactJson(['data' => ['roadFactor' => 1.3]]);
        $this->actingAs($admin)->putJson($url, ['roadFactor' => 0.5])->assertStatus(422)->assertJsonValidationErrors(['roadFactor']);
        $this->actingAs($admin)->putJson($url, ['roadFactor' => 3.5])->assertStatus(422)->assertJsonValidationErrors(['roadFactor']);
        $this->actingAs($admin)->putJson($url, [])->assertStatus(422)->assertJsonValidationErrors(['roadFactor']);

        $this->actingAs($admin)->putJson($url, ['roadFactor' => 2])->assertOk()->assertJsonPath('data.roadFactor', 2);
        $this->actingAs($admin)->getJson($url)->assertJsonPath('data.roadFactor', 2);
        $this->actingAs($this->adminWith(['settings']))->getJson('/api/v1/admin/settings')->assertJsonPath('data.shippingRoadFactor', 2);
        $this->assertSame(2, Setting::find('commerce.shipping_road_factor')->value);

        // Dipakai jarak: 0,1° di khatulistiwa ≈ 11,12 km × 2 = 22,24 → 23 km (× 1,3 dulu = 15 km).
        $factory = $this->factoryLocation(null, ['lat' => 0, 'lng' => 100]);
        $this->assertSame(23, app(\App\Services\Commerce\Shipping\ZoneRateCalculator::class)->distanceKm($factory, ['lat' => 0, 'lng' => 100.1]));
    }

    public function test_commerce_config_lists_factories_and_keeps_default_pickup(): void
    {
        $this->factoryLocation('sei-bamban', ['allows_pickup' => false]);

        $this->withHeaders(['Accept-Language' => 'id'])->getJson('/api/v1/commerce/config')->assertOk()
            ->assertJsonCount(2, 'data.factories')
            ->assertJsonPath('data.factories.0', [
                'code' => 'tanjung-morawa',
                'name' => ['id' => 'Pabrik Tanjung Morawa', 'en' => 'Tanjung Morawa Factory'],
                'address' => 'Jl. Medan - Tanjung Morawa Km 9,5, Medan 20148, Sumatera Utara, Indonesia',
                'lat' => 3.5387,
                'lng' => 98.7467,
                'allowsPickup' => true,
            ])
            ->assertJsonPath('data.factories.1.code', 'sei-bamban')
            ->assertJsonPath('data.factories.1.allowsPickup', false)
            ->assertJsonPath('data.pickup.label', 'Pabrik Tanjung Morawa')
            ->assertJsonPath('data.pickup.lat', 3.5387);
        $this->withHeaders(['Accept-Language' => 'en'])->getJson('/api/v1/commerce/config')->assertJsonPath('data.pickup.label', 'Tanjung Morawa Factory');
    }

    public function test_product_admin_sets_factory_and_public_product_shows_it(): void
    {
        $category = $this->makeCategory();
        $bamban = FactoryLocation::where('code', 'sei-bamban')->firstOrFail();
        $admin = $this->adminWith(['products']);
        $body = ['code' => 'RSP-35', 'categoryId' => $category->id, 'name' => ['id' => 'Resiprene 35'], 'priceMode' => 'fixed', 'price' => 185000, 'isPublished' => true];

        $id = $this->actingAs($admin)->postJson('/api/v1/admin/products', $body + ['factoryLocationId' => $bamban->id])->assertStatus(201)
            ->assertJsonPath('data.factoryLocationId', $bamban->id)
            ->assertJsonPath('data.factoryLocation', ['id' => $bamban->id, 'code' => 'sei-bamban', 'name' => $bamban->name])
            ->assertJsonPath('data.factory.code', 'sei-bamban')
            ->json('data.id');
        $slug = $this->getJson('/api/v1/catalog/products?q=RSP')->assertOk()->assertJsonPath('data.0.factory', ['code' => 'sei-bamban', 'name' => $bamban->name])->json('data.0.slug');
        $this->assertArrayNotHasKey('lat', $this->getJson('/api/v1/catalog/products/'.$slug)->json('data.factory'));

        // Tidak dikirim = tetap; null = ikut pabrik bawaan; id tidak ada = 422.
        $this->actingAs($admin)->putJson('/api/v1/admin/products/'.$id, $body)->assertOk()->assertJsonPath('data.factoryLocationId', $bamban->id);
        $this->actingAs($admin)->putJson('/api/v1/admin/products/'.$id, $body + ['factoryLocationId' => null])->assertOk()
            ->assertJsonPath('data.factoryLocationId', null)
            ->assertJsonPath('data.factoryLocation.code', 'tanjung-morawa');
        $this->actingAs($admin)->putJson('/api/v1/admin/products/'.$id, $body + ['factoryLocationId' => 999999])->assertStatus(422)->assertJsonValidationErrors(['factoryLocationId']);
    }

    public function test_franco_order_snapshot_keeps_per_factory_origins(): void
    {
        $this->setUpCommerce();
        $bamban = FactoryLocation::where('code', 'sei-bamban')->firstOrFail();
        $article = $this->makeProduct(['price' => 100000, 'weight_gram' => 1000], 10);
        $resin = $this->makeProduct(['price' => 100000, 'weight_gram' => 1000, 'factory_location_id' => $bamban->id], 10);
        $items = [['productSlug' => $article->slug, 'qty' => 2], ['productSlug' => $resin->slug, 'qty' => 1]];

        // Tarif fixture: max(60.000, 50.000 + 3.500 × kg) per pabrik → 2 kg = 60.000 dan 1 kg = 60.000.
        $quote = $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', ['items' => $items, 'deliveryTermCode' => 'franco', 'addressId' => $this->buyerAddress->id, 'shippingRateId' => $this->rate->id])
            ->assertOk()
            ->assertJsonPath('data.shippingTotal', 120000)
            ->assertJsonPath('data.shipping.origins.0.factory.code', 'tanjung-morawa')
            ->assertJsonPath('data.shipping.origins.0.weightGram', 2000)
            ->assertJsonPath('data.shipping.origins.0.amount', 60000)
            ->assertJsonPath('data.shipping.origins.1.factory.code', 'sei-bamban')
            ->assertJsonPath('data.shipping.origins.1.breakdown.minimumApplied', true)
            ->assertJsonPath('data.availableShippingRates.0.amount', 120000)
            ->assertJsonPath('data.items.1.factory.code', 'sei-bamban')
            ->assertJsonPath('data.pickupPoints', []);
        $this->assertArrayNotHasKey('unavailable', $quote->json('data.availableShippingRates.0'));

        $order = $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($article, 1, ['items' => $items, 'deliveryTermCode' => 'franco']))
            ->assertStatus(201)
            ->assertJsonPath('data.shippingTotal', 120000)
            ->assertJsonPath('data.shippingMethod.origins.1.factory.code', 'sei-bamban')
            ->assertJsonPath('data.shippingMethod.origins.1.amount', 60000)
            ->assertJsonPath('data.pickupPoints', []);
        $this->assertCount(2, Order::where('number', $order->json('data.number'))->firstOrFail()->shipping_snapshot['origins']);
    }

    // Tanpa Mail::fake agar email "siap diambil" bisa dirender (seperti DeliveryTermCheckoutTest::test_pickup_mails_...).
    public function test_loco_mixed_cart_has_one_pickup_point_per_factory(): void
    {
        $this->setUpCommerce();
        $bamban = FactoryLocation::where('code', 'sei-bamban')->firstOrFail();
        $article = $this->makeProduct(['slug' => 'sarung-egrek', 'price' => 50000], 10);
        $resin = $this->makeProduct(['slug' => 'resiprene-35', 'price' => 100000, 'factory_location_id' => $bamban->id], 10);
        $items = [['productSlug' => $resin->slug, 'qty' => 1], ['productSlug' => $article->slug, 'qty' => 2]];

        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', ['items' => $items, 'deliveryTermCode' => 'loco'])->assertOk()
            ->assertJsonPath('data.shippingTotal', 0)
            ->assertJsonCount(2, 'data.pickupPoints')
            ->assertJsonPath('data.pickupPoints.0.code', 'tanjung-morawa')
            ->assertJsonPath('data.pickupPoints.0.items', ['sarung-egrek'])
            ->assertJsonPath('data.pickupPoints.1.code', 'sei-bamban')
            ->assertJsonPath('data.pickupPoints.1.label', 'Pabrik Resiprene Sei Bamban')
            ->assertJsonPath('data.pickupPoints.1.lat', 3.3495)
            ->assertJsonPath('data.pickupPoints.1.items', ['resiprene-35']);

        $response = $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($article, 1, [
            'items' => $items, 'deliveryTermCode' => 'loco', 'addressId' => null, 'shippingRateId' => null,
        ]))->assertStatus(201)
            ->assertJsonPath('data.shippingAddress.type', 'pickup')
            ->assertJsonPath('data.shippingAddress.label', 'Pabrik Tanjung Morawa') // titik pertama untuk pembaca lama
            ->assertJsonPath('data.shippingAddress.points.1.code', 'sei-bamban')
            ->assertJsonPath('data.pickup.label', 'Pabrik Tanjung Morawa')
            ->assertJsonCount(2, 'data.pickupPoints')
            ->assertJsonPath('data.pickupPoints.1.name.en', 'Resiprene Factory Sei Bamban')
            ->assertJsonPath('data.pickupPoints.1.address', 'Sei Bamban Estate, Kec. Sei Bamban, Kab. Serdang Bedagai 20695, Sumatera Utara, Indonesia');

        // Kalimat histori/notifikasi menggabungkan nama pabrik.
        $order = $this->payOrder(Order::where('number', $response->json('data.number'))->firstOrFail());
        $admin = $this->adminWith(['orders']);
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$order->number.'/status', ['status' => 'processing'])->assertOk();
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$order->number.'/status', ['status' => 'shipped'])->assertOk()
            ->assertJsonPath('data.timeline.4.note', 'Pesanan siap diambil di Pabrik Tanjung Morawa dan Pabrik Resiprene Sei Bamban.');
        $this->assertStringContainsString('Pabrik Tanjung Morawa dan Pabrik Resiprene Sei Bamban', UserNotification::where('type', 'order.ready_for_pickup')->firstOrFail()->body['id']);
        $this->assertSame('Tanjung Morawa Factory and Resiprene Factory Sei Bamban', $order->fresh()->pickupLabel('en'));
        // Email "siap diambil" memuat satu blok per pabrik.
        $html = (new \App\Mail\Commerce\OrderShipped($order->fresh()))->render();
        $this->assertStringContainsString('Pabrik Tanjung Morawa', $html);
        $this->assertStringContainsString('Pabrik Resiprene Sei Bamban', $html);
        $this->assertStringContainsString('Sei Bamban Estate', $html);
    }

    public function test_loco_is_rejected_when_an_item_factory_does_not_allow_pickup(): void
    {
        $this->setUpCommerce();
        $bamban = $this->factoryLocation('sei-bamban', ['allows_pickup' => false]);
        $article = $this->makeProduct(['price' => 50000], 10);
        $resin = $this->makeProduct(['price' => 100000, 'factory_location_id' => $bamban->id], 10);

        $this->actingAs($this->buyer)->withHeaders(['Accept-Language' => 'id'])->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => $article->slug, 'qty' => 1], ['productSlug' => $resin->slug, 'qty' => 1]], 'deliveryTermCode' => 'loco',
        ])->assertStatus(422)->assertJsonValidationErrors(['deliveryTermCode'])
            ->assertJsonPath('errors.deliveryTermCode.0', 'Barang dari Pabrik Resiprene Sei Bamban tidak bisa diambil sendiri. Pilih cara serah terima lain.');
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders', $this->checkoutPayload($resin, 1, ['deliveryTermCode' => 'loco', 'addressId' => null, 'shippingRateId' => null]))
            ->assertStatus(422)->assertJsonValidationErrors(['deliveryTermCode']);
        $this->assertSame(0, Order::count());

        // Barang dari pabrik yang melayani ambil tetap bisa Loco; Franco tetap bisa untuk keranjang campuran.
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $article->slug, 'qty' => 1]], 'deliveryTermCode' => 'loco'])
            ->assertOk()->assertJsonCount(1, 'data.pickupPoints');
        $this->actingAs($this->buyer)->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => $article->slug, 'qty' => 1], ['productSlug' => $resin->slug, 'qty' => 1]], 'deliveryTermCode' => 'franco',
            'addressId' => $this->buyerAddress->id, 'shippingRateId' => $this->rate->id,
        ])->assertOk()->assertJsonCount(2, 'data.shipping.origins');
    }

    /** Instance migrasi (kelas bernama Laravel 8; file sudah dimuat migrator saat RefreshDatabase). */
    private function migration(string $file, string $class)
    {
        if (! class_exists($class)) {
            require_once database_path('migrations/'.$file);
        }

        return new $class();
    }
}
