<?php

namespace Tests\Feature\Catalog;

use App\Models\CustomerProfile;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CatalogFixtures;
use Tests\TestCase;

// Harga USD (kontrak bagian 6, ASUMSI A-86): hanya customer ekspor yang login melihat priceUsd (sen) dan tidak melihat
// rupiah; tamu, customer lokal, dan mesin pencari tidak pernah melihat USD. Admin mengelola priceUsd dalam sen.
class ExportCatalogTest extends TestCase
{
    use RefreshDatabase, CatalogFixtures;

    private function exporter()
    {
        $user = $this->customer(['email' => 'buyer@rubbertrade.example']);
        $user->profile()->create(['company' => 'Rubber Trade Sdn. Bhd.', 'market' => CustomerProfile::MARKET_EXPORT, 'country_code' => 'MY']);

        return $user;
    }

    public function test_price_usd_is_visible_only_to_logged_in_export_customers_and_hides_rupiah(): void
    {
        $withUsd = $this->makeProduct(['slug' => 'resiprene-35', 'price' => 185000, 'price_usd' => '12.50'], 100);
        $this->makeProduct(['slug' => 'sarung-egrek', 'price' => 125000], 100); // belum punya harga USD

        // Tamu: rupiah saja, tanpa kunci priceUsd.
        $guest = $this->getJson('/api/v1/catalog/products?sort=name')->assertOk()
            ->assertJsonPath('data.0.currency', 'IDR')->assertJsonPath('data.0.price', 185000)->assertJsonPath('data.0.effectivePrice', 185000);
        $this->assertArrayNotHasKey('priceUsd', $guest->json('data.0'));
        $detail = $this->getJson('/api/v1/catalog/products/resiprene-35')->assertOk()->assertJsonPath('data.price', 185000);
        $this->assertArrayNotHasKey('priceUsd', $detail->json('data'));

        // Customer lokal: sama dengan tamu.
        $local = $this->customer();
        $local->profile()->create(['company' => 'PT Lokal']);
        $row = $this->actingAs($local)->getJson('/api/v1/catalog/products?sort=name')->assertOk()->assertJsonPath('data.0.currency', 'IDR')->json('data.0');
        $this->assertArrayNotHasKey('priceUsd', $row);

        // Customer ekspor: USD (sen) saja; produk tanpa harga USD tampil dengan priceUsd null.
        $this->app['auth']->forgetGuards();
        $export = $this->actingAs($this->exporter())->getJson('/api/v1/catalog/products?sort=name')->assertOk()
            ->assertJsonPath('data.0.currency', 'USD')->assertJsonPath('data.0.priceUsd', 1250)
            ->assertJsonPath('data.1.slug', 'sarung-egrek')->assertJsonPath('data.1.priceUsd', null);
        foreach (['price', 'promoPrice', 'effectivePrice', 'promoEndsAt'] as $key) {
            $this->assertArrayNotHasKey($key, $export->json('data.0'), $key);
        }
        $detail = $this->getJson('/api/v1/catalog/products/resiprene-35')->assertOk()->assertJsonPath('data.priceUsd', 1250)->assertJsonPath('data.currency', 'USD');
        $this->assertArrayNotHasKey('price', $detail->json('data'));
        $this->assertSame($withUsd->id, $detail->json('data.id'));
    }

    public function test_sort_by_price_uses_usd_for_export_viewers_and_rupiah_for_others(): void
    {
        // Urutan rupiah dan USD sengaja berlawanan.
        $this->makeProduct(['slug' => 'mahal-idr', 'price' => 900000, 'price_usd' => '5.00'], 10);
        $this->makeProduct(['slug' => 'murah-idr', 'price' => 100000, 'price_usd' => '50.00'], 10);
        $this->makeProduct(['slug' => 'tanpa-usd', 'price' => 50000], 10);

        $this->assertSame(['tanpa-usd', 'murah-idr', 'mahal-idr'], array_column($this->getJson('/api/v1/catalog/products?sort=price')->json('data'), 'slug'));

        $this->actingAs($this->exporter());
        $this->assertSame(['mahal-idr', 'murah-idr', 'tanpa-usd'], array_column($this->getJson('/api/v1/catalog/products?sort=price')->json('data'), 'slug'));
    }

    public function test_admin_manages_price_usd_in_cents_and_quote_mode_clears_it(): void
    {
        $admin = $this->adminWith(['products']);
        $category = $this->makeCategory();
        $body = ['code' => 'RSP-35', 'categoryId' => $category->id, 'name' => ['id' => 'Resiprene 35'], 'priceMode' => 'fixed', 'price' => 185000, 'priceUsd' => 1250, 'unit' => 'kg', 'moq' => 25];

        $created = $this->actingAs($admin)->postJson('/api/v1/admin/products', $body)->assertCreated()
            ->assertJsonPath('data.currency', 'IDR')->assertJsonPath('data.price', 185000)->assertJsonPath('data.priceUsd', 1250)->assertJsonPath('data.priceUsdSet', true);
        $id = $created->json('data.id');
        $this->assertSame('12.50', Product::findOrFail($id)->price_usd);

        // Tidak dikirim = tetap; null = dikosongkan; sen harus bilangan bulat.
        $this->actingAs($admin)->putJson("/api/v1/admin/products/$id", array_merge($body, ['priceUsd' => 1299]))->assertOk()->assertJsonPath('data.priceUsd', 1299);
        $this->assertSame('12.99', Product::findOrFail($id)->price_usd);
        $keep = $body;
        unset($keep['priceUsd']);
        $this->actingAs($admin)->putJson("/api/v1/admin/products/$id", $keep)->assertOk()->assertJsonPath('data.priceUsd', 1299);
        $this->actingAs($admin)->putJson("/api/v1/admin/products/$id", array_merge($body, ['priceUsd' => 12.5]))->assertStatus(422)->assertJsonValidationErrors(['priceUsd']);
        $this->actingAs($admin)->putJson("/api/v1/admin/products/$id", array_merge($body, ['priceUsd' => null]))->assertOk()->assertJsonPath('data.priceUsd', null)->assertJsonPath('data.priceUsdSet', false);

        $this->actingAs($admin)->putJson("/api/v1/admin/products/$id", array_merge($body, ['priceMode' => 'quote']))->assertOk()->assertJsonPath('data.priceUsd', null)->assertJsonPath('data.price', null);
        $this->assertNull(Product::findOrFail($id)->price_usd);
    }
}
