<?php

namespace App\Services\Stock;

use App\Exceptions\ApiException;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

/**
 * Satu-satunya penulis stock_movements dan cache products.stock_qty/reserved_qty (arsitektur bagian 8).
 *
 * | type    | qty | efek ke products                    | idempotency_key                     |
 * | in      | +n  | stock_qty += n                      | opsional                            |
 * | adjust  | ±n  | stock_qty += n                      | opsional                            |
 * | reserve | +n  | reserved_qty += n                   | order:{id}:reserve:{product_id}     |
 * | release | −n  | reserved_qty −= n                   | order:{id}:release:{product_id}     |
 * | commit  | −n  | reserved_qty −= n, stock_qty −= n   | order:{id}:commit:{product_id}      |
 *
 * Idempotensi: INSERT ... ON CONFLICT (idempotency_key) DO NOTHING; cache hanya diubah bila baris benar-benar terinsert.
 * Cache ditulis lewat query builder (bukan Eloquent) sehingga guard di Product::saving menolak jalur lain.
 */
class StockLedger
{
    public function in(Product $product, int $qty, ?string $note = null, ?User $by = null, ?string $idempotencyKey = null): ?StockMovement
    {
        $this->assertPositive($qty);

        return $this->record($product, StockMovement::TYPE_IN, $qty, null, null, $idempotencyKey, $note, $by);
    }

    /** qty bertanda; tidak boleh membuat available < 0 (422). */
    public function adjust(Product $product, int $qty, ?string $note = null, ?User $by = null, ?string $idempotencyKey = null): ?StockMovement
    {
        if ($qty === 0) {
            throw ValidationException::withMessages(['qty' => [__('catalog.stock_qty_zero')]]);
        }

        return $this->record($product, StockMovement::TYPE_ADJUST, $qty, null, null, $idempotencyKey, $note, $by);
    }

    /** @param  object|int  $order  model Order (punya id) atau id order */
    public function reserve(Product $product, int $qty, $order, ?User $by = null): ?StockMovement
    {
        $this->assertPositive($qty);
        $orderId = $this->orderId($order);

        return $this->record($product, StockMovement::TYPE_RESERVE, $qty, StockMovement::REFERENCE_ORDER, $orderId, self::key($orderId, StockMovement::TYPE_RESERVE, $product->id), null, $by);
    }

    /** @param  object|int  $order */
    public function release(Product $product, int $qty, $order, ?User $by = null): ?StockMovement
    {
        $this->assertPositive($qty);
        $orderId = $this->orderId($order);

        return $this->record($product, StockMovement::TYPE_RELEASE, -$qty, StockMovement::REFERENCE_ORDER, $orderId, self::key($orderId, StockMovement::TYPE_RELEASE, $product->id), null, $by);
    }

    /** @param  object|int  $order */
    public function commit(Product $product, int $qty, $order, ?User $by = null): ?StockMovement
    {
        $this->assertPositive($qty);
        $orderId = $this->orderId($order);

        return $this->record($product, StockMovement::TYPE_COMMIT, -$qty, StockMovement::REFERENCE_ORDER, $orderId, self::key($orderId, StockMovement::TYPE_COMMIT, $product->id), null, $by);
    }

    public static function key(int $orderId, string $type, int $productId): string
    {
        return sprintf('order:%d:%s:%d', $orderId, $type, $productId);
    }

    /**
     * Hitung ulang cache products.stock_qty/reserved_qty dari ledger (dipakai stock:rebuild, test, pemulihan).
     *
     * @return int jumlah produk yang diperbarui
     */
    public function rebuild(?int $productId = null): int
    {
        $count = 0;
        $query = Product::withTrashed()->when($productId, fn ($q) => $q->where('id', $productId))->orderBy('id');

        foreach ($query->cursor() as $product) {
            $sums = DB::table('stock_movements')->where('product_id', $product->id)
                ->selectRaw("COALESCE(SUM(CASE WHEN type IN ('in','adjust','commit') THEN qty ELSE 0 END), 0) AS stock")
                ->selectRaw("COALESCE(SUM(CASE WHEN type IN ('reserve','release','commit') THEN qty ELSE 0 END), 0) AS reserved")
                ->first();

            $stock = (int) $sums->stock;
            $reserved = (int) $sums->reserved;
            DB::table('products')->where('id', $product->id)->update([
                'stock_qty' => $stock,
                'reserved_qty' => $reserved,
                'stock_status' => Product::deriveStockStatus($stock - $reserved, $product->stock_status),
            ]);
            $count++;
        }

        return $count;
    }

    private function record(Product $product, string $type, int $signedQty, ?string $refType, ?int $refId, ?string $key, ?string $note, ?User $by): ?StockMovement
    {
        return DB::transaction(function () use ($product, $type, $signedQty, $refType, $refId, $key, $note, $by) {
            // Kunci baris produk agar pengecekan available dan update cache atomik terhadap checkout paralel.
            $row = DB::table('products')->where('id', $product->id)->lockForUpdate()->first(['stock_qty', 'reserved_qty', 'stock_status']);
            if (! $row) {
                throw ApiException::notFound();
            }

            // Idempotensi: key yang sudah ada = pemanggilan ulang; cache tidak disentuh (dicek sebelum validasi).
            if ($key !== null && StockMovement::where('idempotency_key', $key)->exists()) {
                return null;
            }

            // in/adjust: stock ± n; reserve: reserved + n; release: reserved − n; commit: stock − n dan reserved − n.
            $stockDelta = in_array($type, [StockMovement::TYPE_IN, StockMovement::TYPE_ADJUST, StockMovement::TYPE_COMMIT], true) ? $signedQty : 0;
            $reservedDelta = in_array($type, [StockMovement::TYPE_RESERVE, StockMovement::TYPE_RELEASE, StockMovement::TYPE_COMMIT], true) ? $signedQty : 0;
            $available = (int) $row->stock_qty - (int) $row->reserved_qty;
            $newStock = (int) $row->stock_qty + $stockDelta;
            $newReserved = (int) $row->reserved_qty + $reservedDelta;

            if ($type === StockMovement::TYPE_ADJUST && $newStock - $newReserved < 0) {
                throw ValidationException::withMessages(['qty' => [__('catalog.stock_adjust_negative', ['available' => $available])]]);
            }

            if ($type === StockMovement::TYPE_RESERVE && $newStock - $newReserved < 0) {
                throw ApiException::conflict('INSUFFICIENT_STOCK', __('catalog.insufficient_stock'), [
                    'items' => [['productSlug' => $product->slug, 'requested' => $signedQty, 'available' => $available]],
                ]);
            }

            if ($newReserved < 0 || $newStock < 0) {
                throw new LogicException(sprintf('Stock ledger invariant violated for product %d (%s %d).', $product->id, $type, $signedQty));
            }

            $inserted = DB::select(
                'INSERT INTO stock_movements (product_id, type, qty, reference_type, reference_id, idempotency_key, note, created_by, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (idempotency_key) DO NOTHING
                 RETURNING id',
                [$product->id, $type, $signedQty, $refType, $refId, $key, $note, $by?->id, now()->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s')]
            );

            if ($inserted === []) {
                return null; // race: key baru saja ditulis transaksi lain
            }

            DB::table('products')->where('id', $product->id)->update([
                'stock_qty' => $newStock,
                'reserved_qty' => $newReserved,
                'stock_status' => Product::deriveStockStatus($newStock - $newReserved, (string) $row->stock_status),
            ]);

            $this->syncModel($product, $newStock, $newReserved);

            return StockMovement::find($inserted[0]->id);
        });
    }

    /** Segarkan cache pada instance model tanpa memicu Product::saving. */
    private function syncModel(Product $product, int $stock, int $reserved): void
    {
        $product->setRawAttributes(array_merge($product->getAttributes(), [
            'stock_qty' => $stock,
            'reserved_qty' => $reserved,
            'stock_status' => Product::deriveStockStatus($stock - $reserved, (string) $product->stock_status),
        ]), true);
    }

    /** @param  object|int  $order */
    private function orderId($order): int
    {
        if (is_int($order)) {
            return $order;
        }
        if (is_object($order) && isset($order->id)) {
            return (int) $order->id;
        }

        throw new LogicException('StockLedger expects an order model or order id.');
    }

    private function assertPositive(int $qty): void
    {
        if ($qty <= 0) {
            throw ValidationException::withMessages(['qty' => [__('catalog.stock_qty_positive')]]);
        }
    }
}
