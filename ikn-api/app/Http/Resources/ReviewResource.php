<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

// Ulasan produk: bentuk publik (tipe Review FE: customer, rating, body, date) + field moderasi untuk admin.
class ReviewResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'productId' => $this->product_id,
            'productSlug' => $this->whenLoaded('product', fn () => $this->product?->slug),
            'productName' => $this->whenLoaded('product', fn () => $this->product?->name),
            'userId' => $this->user_id,
            'customer' => $this->whenLoaded('user', fn () => $this->user?->name, null),
            'orderId' => $this->order_id,
            'rating' => $this->rating,
            'body' => $this->body,
            'isPublished' => $this->is_published,
            'date' => optional($this->created_at)->toApiString(),
            'createdAt' => optional($this->created_at)->toApiString(),
        ];
    }
}
