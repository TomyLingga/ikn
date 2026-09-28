<?php

namespace Tests\Feature\Catalog;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CatalogFixtures;
use Tests\TestCase;

// Kontrak 11.3 stok: GET ledger berpaginasi + ringkasan, POST in|adjust lewat StockLedger.
class StockAdminTest extends TestCase
{
    use RefreshDatabase, CatalogFixtures;

    public function test_stock_in_and_adjust_update_summary_and_ledger(): void
    {
        $product = $this->makeProduct(['slug' => 'sepatu-boots']);
        $admin = $this->adminWith(['stock']);

        $this->actingAs($admin)->postJson('/api/v1/admin/products/'.$product->id.'/stock', ['type' => 'in', 'qty' => 350, 'note' => 'Produksi batch 1'])
            ->assertStatus(201)
            ->assertJsonPath('data.stock', 350)
            ->assertJsonPath('data.reserved', 0)
            ->assertJsonPath('data.available', 350)
            ->assertJsonPath('data.stockStatus', 'in_stock')
            ->assertJsonPath('data.movement.type', 'in')
            ->assertJsonPath('data.movement.qty', 350)
            ->assertJsonPath('data.movement.createdBy.id', $admin->id);

        $this->actingAs($admin)->postJson('/api/v1/admin/products/'.$product->id.'/stock', ['type' => 'adjust', 'qty' => -50, 'note' => 'Rusak'])
            ->assertStatus(201)->assertJsonPath('data.stock', 300)->assertJsonPath('data.movement.qty', -50);

        $ledger = $this->actingAs($admin)->getJson('/api/v1/admin/products/'.$product->id.'/stock?perPage=1')->assertOk();
        $ledger->assertJsonPath('data.stock', 300)
            ->assertJsonPath('data.available', 300)
            ->assertJsonPath('data.product.slug', 'sepatu-boots')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.lastPage', 2)
            ->assertJsonCount(1, 'data.movements')
            ->assertJsonPath('data.movements.0.type', 'adjust');

        $this->getJson('/api/v1/catalog/products/sepatu-boots')->assertOk()->assertJsonPath('data.available', 300)->assertJsonPath('data.stock', 300);
    }

    public function test_adjust_cannot_make_available_negative_and_zero_is_rejected(): void
    {
        $product = $this->makeProduct([], 20);
        $admin = $this->adminWith(['stock']);

        $this->actingAs($admin)->postJson('/api/v1/admin/products/'.$product->id.'/stock', ['type' => 'adjust', 'qty' => -21])
            ->assertStatus(422)->assertJsonPath('code', 'VALIDATION_ERROR')->assertJsonStructure(['errors' => ['qty']]);

        $this->actingAs($admin)->postJson('/api/v1/admin/products/'.$product->id.'/stock', ['type' => 'adjust', 'qty' => 0])
            ->assertStatus(422)->assertJsonStructure(['errors' => ['qty']]);

        $this->actingAs($admin)->postJson('/api/v1/admin/products/'.$product->id.'/stock', ['type' => 'reserve', 'qty' => 1])
            ->assertStatus(422)->assertJsonStructure(['errors' => ['type']]);

        $this->assertSame(20, $product->fresh()->stock_qty);
    }

    public function test_stock_endpoints_require_stock_module(): void
    {
        $product = $this->makeProduct();

        $this->actingAs($this->adminWith(['products']))->getJson('/api/v1/admin/products/'.$product->id.'/stock')->assertStatus(403);
        $this->actingAs($this->adminWith(['products']))->postJson('/api/v1/admin/products/'.$product->id.'/stock', ['type' => 'in', 'qty' => 1])->assertStatus(403);
        $this->actingAs($this->customer())->getJson('/api/v1/admin/products/'.$product->id.'/stock')->assertStatus(403);
    }
}
