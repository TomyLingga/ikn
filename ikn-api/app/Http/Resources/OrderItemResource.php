<?php

namespace App\Http\Resources;

use App\Models\OrderItem;
use Illuminate\Http\Resources\Json\JsonResource;

// Item order dari snapshot (harga beku). `reviewed` dan `review` diisi bila order memuat relasi reviews.
class OrderItemResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var OrderItem $item */
        $item = $this->resource;
        $snapshot = $item->product_snapshot ?? [];
        $order = $item->relationLoaded('order') ? $item->order : null;
        $reviewed = $order && $order->relationLoaded('reviews')
            ? in_array((int) $item->product_id, $order->reviewedProductIds(), true)
            : null;

        $review = $reviewed ? $order->reviews->firstWhere('product_id', $item->product_id) : null;

        return [
            'id' => $item->id,
            'productId' => $item->product_id,
            'productSlug' => $snapshot['slug'] ?? null,
            'code' => $snapshot['code'] ?? null,
            'name' => $item->productName(),
            'unit' => $snapshot['unit'] ?? null,
            'image' => $snapshot['image'] ?? null,
            'categoryId' => $snapshot['categoryId'] ?? null,
            'qty' => $item->qty,
            'unitPrice' => $item->unitPriceInt(),
            'discountAmount' => $item->discountAmountInt(),
            'taxAmount' => $item->taxAmountInt(),
            'lineTotal' => $item->lineTotalInt(),
            'weightGram' => $item->weight_gram,
            'reviewed' => $reviewed,
            // Ulasan customer untuk produk ini pada order ini (null bila belum diulas).
            'review' => $review ? [
                'rating' => (int) $review->rating,
                'body' => $review->body,
                'date' => optional($review->created_at)->toApiString(),
            ] : null,
        ];
    }
}
