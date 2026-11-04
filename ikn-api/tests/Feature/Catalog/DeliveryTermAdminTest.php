<?php

namespace Tests\Feature\Catalog;

use App\Models\DeliveryTerm;
use App\Services\Commerce\DeliveryTermResolver;
use Database\Seeders\DeliveryTermSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Cara serah terima admin (kontrak 11.8, ASUMSI A-85): CRUD + validasi, modul shipping, 409 bila dipakai order,
// dan tampilannya di GET /commerce/config. Titik ambil Loco = lokasi pabrik (FactoryLocationTest, ASUMSI A-90).
class DeliveryTermAdminTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    // Migrasi create_delivery_terms_table mengisi baris bawaan sendiri (pola A-59), tanpa fixture dan tanpa seeder:
    // basis data yang hanya menjalankan `migrate` harus langsung bisa quote/checkout dengan Loco.
    public function test_migration_seeds_default_terms_with_loco_active_first_and_franco_inactive(): void
    {
        $terms = DeliveryTerm::orderBy('sort_order')->get();

        $this->assertSame(['loco', 'franco', 'fob', 'cif'], $terms->pluck('code')->all());
        $this->assertSame([1, 2, 3, 4], $terms->pluck('sort_order')->all());
        $this->assertSame([true, false, true, true], $terms->pluck('is_active')->all());
        $this->assertSame(['local', 'local', 'export', 'export'], $terms->pluck('market')->all());
        $this->assertSame(['none', 'zone', 'included', 'quoted'], $terms->pluck('pricing_mode')->all());
        // Migrasi 000080 dan seeder memberi profil pajak yang sama (FOB/CIF ekspor, lokal domestik).
        $this->assertSame(['domestic', 'domestic', 'export', 'export'], $terms->pluck('tax_profile')->all());
        $this->assertSame(['domestic', 'domestic', 'export', 'export'], array_column(DeliveryTermSeeder::rows(), 'tax_profile'));
        $this->assertSame('Loco (pickup at factory)', $terms[0]->name['en']);
        $this->assertSame('Belawan', $terms[2]->loading_port);
        $this->assertTrue($terms[3]->insurance_included);
        $this->assertTrue($terms[3]->requires_destination_port);

        $this->assertSame('loco', app(DeliveryTermResolver::class)->resolve(null)->code);
        $this->getJson('/api/v1/commerce/config')->assertOk()
            ->assertJsonCount(1, 'data.deliveryTerms')
            ->assertJsonPath('data.deliveryTerms.0.code', 'loco');

        // Seeder memakai baris yang sama dan idempoten: migrate --seed tidak menggandakan.
        (new DeliveryTermSeeder)->run();
        $this->assertSame(4, DeliveryTerm::count());
    }

    public function test_admin_crud_delivery_terms_with_validation_and_module_guard(): void
    {
        // CRUD diuji dari tabel kosong; baris bawaan migrasi diuji di test di atas.
        DeliveryTerm::query()->delete();
        $admin = $this->adminWith(['shipping']);
        $url = '/api/v1/admin/delivery-terms';

        $this->actingAs($this->adminWith(['orders']))->getJson($url)->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');

        $loco = $this->actingAs($admin)->postJson($url, [
            'code' => 'Loco', 'name' => ['id' => 'Loco (ambil di pabrik)'], 'description' => ['id' => 'Barang diambil sendiri di pabrik.'],
            'family' => 'pickup', 'market' => 'local', 'pricingMode' => 'none', 'sortOrder' => 1,
        ])->assertStatus(201)
            ->assertJsonPath('data.code', 'loco')
            ->assertJsonPath('data.name.id', 'Loco (ambil di pabrik)')
            ->assertJsonPath('data.name.en', 'Loco (ambil di pabrik)') // en diisi dari id
            ->assertJsonPath('data.family', 'pickup')
            ->assertJsonPath('data.market', 'local')
            ->assertJsonPath('data.pricingMode', 'none')
            ->assertJsonPath('data.insuranceIncluded', false)
            ->assertJsonPath('data.requiresDestinationPort', false)
            ->assertJsonPath('data.loadingPort', null)
            ->assertJsonPath('data.isActive', true)
            ->assertJsonPath('data.sortOrder', 1)
            ->json('data.id');

        $fob = $this->actingAs($admin)->postJson($url, [
            'code' => 'fob', 'name' => ['id' => 'FOB Belawan', 'en' => 'FOB Belawan'], 'family' => 'port', 'market' => 'export',
            'pricingMode' => 'included', 'loadingPort' => ' Belawan ', 'isActive' => false, 'sortOrder' => 3,
        ])->assertStatus(201)->assertJsonPath('data.loadingPort', 'Belawan')->assertJsonPath('data.isActive', false)->json('data.id');

        // Validasi: kode ganda, kode tidak slug, keluarga/pasar/cara biaya di luar daftar, nama id wajib.
        $this->actingAs($admin)->postJson($url, ['code' => 'loco', 'name' => ['id' => 'X'], 'family' => 'pickup', 'market' => 'local', 'pricingMode' => 'none'])
            ->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->actingAs($admin)->postJson($url, ['code' => 'Ambil Sendiri', 'name' => ['id' => 'X'], 'family' => 'pickup', 'market' => 'local', 'pricingMode' => 'none'])
            ->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->actingAs($admin)->postJson($url, ['code' => 'x', 'name' => ['en' => 'Only EN'], 'family' => 'truck', 'market' => 'global', 'pricingMode' => 'free'])
            ->assertStatus(422)->assertJsonValidationErrors(['name.id', 'family', 'market', 'pricingMode']);

        $this->actingAs($admin)->getJson($url)->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.code', 'loco')
            ->assertJsonPath('data.0.ordersCount', 0)
            ->assertJsonPath('data.1.code', 'fob');

        // Ubah: kode tidak bisa diganti (kode sama boleh dikirim), field lain bebas.
        $this->actingAs($admin)->putJson($url.'/'.$loco, [
            'code' => 'loco', 'name' => ['id' => 'Loco', 'en' => 'Loco'], 'family' => 'pickup', 'market' => 'local', 'pricingMode' => 'none', 'isActive' => false, 'sortOrder' => 5,
        ])->assertOk()->assertJsonPath('data.code', 'loco')->assertJsonPath('data.name.en', 'Loco')->assertJsonPath('data.isActive', false)->assertJsonPath('data.sortOrder', 5);
        $this->actingAs($admin)->putJson($url.'/'.$loco, ['code' => 'ambil', 'name' => ['id' => 'Loco'], 'family' => 'pickup', 'market' => 'local', 'pricingMode' => 'none'])
            ->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->assertSame('loco', DeliveryTerm::find($loco)->code);

        // Konfigurasi publik hanya memuat term aktif pasar lokal (urut sort_order) + titik ambil.
        $this->actingAs($admin)->putJson($url.'/'.$loco, ['name' => ['id' => 'Loco'], 'family' => 'pickup', 'market' => 'local', 'pricingMode' => 'none', 'isActive' => true, 'sortOrder' => 1])->assertOk();
        $this->actingAs($admin)->putJson($url.'/'.$fob, ['name' => ['id' => 'FOB Belawan'], 'family' => 'port', 'market' => 'export', 'pricingMode' => 'included', 'isActive' => true])->assertOk();
        // `pickup` = pabrik bawaan (ASUMSI A-90), label = nama pabrik dalam bahasa request.
        $this->withHeaders(['Accept-Language' => 'id'])->getJson('/api/v1/commerce/config')->assertOk()
            ->assertJsonCount(1, 'data.deliveryTerms')
            ->assertJsonPath('data.deliveryTerms.0.code', 'loco')
            ->assertJsonPath('data.deliveryTerms.0.pricingMode', 'none')
            ->assertJsonPath('data.pickup.label', 'Pabrik Tanjung Morawa')
            ->assertJsonPath('data.pickup.lat', 3.5387)
            ->assertJsonPath('data.pickup.lng', 98.7467);
        $this->assertArrayNotHasKey('id', $this->getJson('/api/v1/commerce/config')->json('data.deliveryTerms.0'));

        $this->actingAs($admin)->deleteJson($url.'/'.$fob)->assertOk()->assertJsonPath('data.deleted', true);
        $this->actingAs($admin)->getJson($url)->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($admin)->deleteJson($url.'/999')->assertStatus(404);
    }

    public function test_delete_is_rejected_while_orders_use_the_term(): void
    {
        $this->setUpCommerce(); // franco + loco aktif
        $product = $this->makeProduct([], 10);
        $this->placeOrder($product, 1); // franco (bawaan)
        $admin = $this->adminWith(['shipping']);
        $franco = DeliveryTerm::where('code', 'franco')->first();
        $loco = DeliveryTerm::where('code', 'loco')->first();

        $this->actingAs($admin)->getJson('/api/v1/admin/delivery-terms')->assertOk()->assertJsonPath('data.0.code', 'franco')->assertJsonPath('data.0.ordersCount', 1);
        $this->actingAs($admin)->deleteJson('/api/v1/admin/delivery-terms/'.$franco->id)
            ->assertStatus(409)->assertJsonPath('code', 'DELIVERY_TERM_IN_USE');
        $this->assertDatabaseHas('delivery_terms', ['code' => 'franco']);

        $this->actingAs($admin)->deleteJson('/api/v1/admin/delivery-terms/'.$loco->id)->assertOk();
        $this->assertDatabaseMissing('delivery_terms', ['code' => 'loco']);
    }
}
