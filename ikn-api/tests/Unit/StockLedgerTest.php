<?php

namespace Tests\Unit;

use App\Exceptions\ApiException;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\Stock\StockLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;
use Tests\Support\CatalogFixtures;
use Tests\TestCase;

// Ledger stok (arsitektur bagian 8): satu-satunya penulis stock_movements dan cache products.
class StockLedgerTest extends TestCase
{
    use RefreshDatabase, CatalogFixtures;

    private StockLedger $ledger;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ledger = app(StockLedger::class);
    }

    public function test_in_increases_stock_and_derives_status(): void
    {
        $product = $this->makeProduct();
        $this->assertSame(Product::STOCK_OUT_OF_STOCK, $product->stock_status);

        $movement = $this->ledger->in($product, 50, 'Saldo awal');

        $this->assertSame(StockMovement::TYPE_IN, $movement->type);
        $this->assertSame(50, $movement->qty);
        $this->assertSame(50, $product->stock_qty);
        $this->assertSame(50, $product->available);
        $this->assertSame(Product::STOCK_IN_STOCK, $product->fresh()->stock_status);
    }

    public function test_reserve_increases_reserved_and_lowers_available(): void
    {
        $product = $this->makeProduct([], 100);

        $this->ledger->reserve($product, 30, 7);

        $product->refresh();
        $this->assertSame(100, $product->stock_qty);
        $this->assertSame(30, $product->reserved_qty);
        $this->assertSame(70, $product->available);
        $this->assertDatabaseHas('stock_movements', ['idempotency_key' => 'order:7:reserve:'.$product->id, 'qty' => 30, 'reference_type' => 'order', 'reference_id' => 7]);
    }

    public function test_release_twice_with_same_key_changes_stock_once(): void
    {
        $product = $this->makeProduct([], 100);
        $this->ledger->reserve($product, 30, 7);

        $first = $this->ledger->release($product, 30, 7);
        $second = $this->ledger->release($product, 30, 7);

        $this->assertNotNull($first);
        $this->assertNull($second);
        $product->refresh();
        $this->assertSame(0, $product->reserved_qty);
        $this->assertSame(100, $product->available);
        $this->assertSame(1, StockMovement::where('type', StockMovement::TYPE_RELEASE)->count());
    }

    public function test_commit_decreases_stock_and_reserved(): void
    {
        $product = $this->makeProduct([], 100);
        $this->ledger->reserve($product, 40, 9);

        $this->ledger->commit($product, 40, 9);
        $this->ledger->commit($product, 40, 9); // idempoten

        $product->refresh();
        $this->assertSame(60, $product->stock_qty);
        $this->assertSame(0, $product->reserved_qty);
        $this->assertSame(60, $product->available);
        $this->assertSame(1, StockMovement::where('type', StockMovement::TYPE_COMMIT)->count());
    }

    public function test_rebuild_matches_cache(): void
    {
        $product = $this->makeProduct([], 100);
        $this->ledger->adjust($product, -10, 'rusak');
        $this->ledger->reserve($product, 25, 1);
        $this->ledger->reserve($product, 15, 2);
        $this->ledger->commit($product, 25, 1);
        $this->ledger->release($product, 15, 2);

        $expected = $product->fresh();
        $this->assertSame(65, $expected->stock_qty);
        $this->assertSame(0, $expected->reserved_qty);

        // Rusak cache secara sengaja lewat SQL langsung, lalu rebuild.
        DB::table('products')->where('id', $product->id)->update(['stock_qty' => 0, 'reserved_qty' => 99, 'stock_status' => Product::STOCK_OUT_OF_STOCK]);
        $this->artisan('stock:rebuild')->assertExitCode(0);

        $rebuilt = $product->fresh();
        $this->assertSame(65, $rebuilt->stock_qty);
        $this->assertSame(0, $rebuilt->reserved_qty);
        $this->assertSame(Product::STOCK_IN_STOCK, $rebuilt->stock_status);
    }

    public function test_adjust_cannot_make_available_negative(): void
    {
        $product = $this->makeProduct([], 20);
        $this->ledger->reserve($product, 15, 3);

        $this->expectException(ValidationException::class);
        $this->ledger->adjust($product, -10, 'terlalu banyak'); // available 5 → -5
    }

    public function test_reserve_beyond_available_is_rejected_with_insufficient_stock(): void
    {
        $product = $this->makeProduct([], 5);

        try {
            $this->ledger->reserve($product, 6, 11);
            $this->fail('expected INSUFFICIENT_STOCK');
        } catch (ApiException $e) {
            $this->assertSame(409, $e->status);
            $this->assertSame('INSUFFICIENT_STOCK', $e->errorCode);
            $this->assertSame([['productSlug' => $product->slug, 'requested' => 6, 'available' => 5]], $e->meta['items']);
        }

        $this->assertSame(0, $product->fresh()->reserved_qty);
    }

    public function test_stock_columns_cannot_be_written_outside_ledger(): void
    {
        $product = $this->makeProduct([], 10);

        $this->expectException(LogicException::class);
        $product->stock_qty = 999;
        $product->save();
    }

    public function test_made_to_order_status_is_kept_manually(): void
    {
        $product = $this->makeProduct(['stock_status' => Product::STOCK_MADE_TO_ORDER]);
        $this->assertSame(Product::STOCK_MADE_TO_ORDER, $product->stock_status);

        $this->ledger->in($product, 5);
        $this->assertSame(Product::STOCK_MADE_TO_ORDER, $product->fresh()->stock_status);
    }
}
