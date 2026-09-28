<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\StockMovementRequest;
use App\Http\Resources\StockMovementResource;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\Stock\StockLedger;

// Stok admin (kontrak 11.3): ledger berpaginasi + ringkasan; mutasi in/adjust hanya lewat StockLedger.
class StockController extends ApiController
{
    public function show(Product $product)
    {
        $paginator = $product->stockMovements()->with('creator')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($this->perPage(20));

        return response()->json([
            'data' => $this->summary($product) + [
                'movements' => StockMovementResource::collection(collect($paginator->items()))->resolve(),
            ],
            'meta' => [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(StockMovementRequest $request, Product $product, StockLedger $ledger)
    {
        $data = $request->validated();
        $qty = (int) $data['qty'];
        $note = $data['note'] ?? null;

        $movement = $data['type'] === StockMovement::TYPE_IN
            ? $ledger->in($product, $qty, $note, $request->user())
            : $ledger->adjust($product, $qty, $note, $request->user());

        return $this->created($this->summary($product->fresh()) + [
            'movement' => (new StockMovementResource($movement->load('creator')))->resolve(),
        ]);
    }

    private function summary(Product $product): array
    {
        return [
            'product' => ['id' => $product->id, 'slug' => $product->slug, 'code' => $product->code, 'name' => $product->name],
            'stock' => (int) $product->stock_qty,
            'reserved' => (int) $product->reserved_qty,
            'available' => $product->available,
            'stockStatus' => $product->stock_status,
        ];
    }
}
