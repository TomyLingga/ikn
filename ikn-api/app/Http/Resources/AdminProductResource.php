<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Resources\Json\JsonResource;

// Bentuk produk untuk panel admin: superset ProductResource + promo mentah, reserved, isPublished, timestamp.
class AdminProductResource extends JsonResource
{
    public function toArray($request): array
    {
        $public = (new ProductResource($this->resource))->toArray($request);
        $images = $this->relationLoaded('images') ? $this->images : $this->images()->with('media')->get();

        return array_merge($public, [
            'categoryId' => $this->category_id,
            'category' => $this->category ? $this->category->toSummary() : null,
            'promoPrice' => $this->promo_price === null ? null : Money::toInt($this->promo_price),
            'promoStartsAt' => optional($this->promo_starts_at)->toApiString(),
            'promoEndsAt' => optional($this->promo_ends_at)->toApiString(),
            'promoActive' => $this->promoActive(),
            'reserved' => (int) $this->reserved_qty,
            'isPublished' => $this->is_published,
            'images' => $images->map(fn ($image) => $image->toSummary() + ['mediaId' => $image->media_id, 'media' => $image->media ? $image->media->toSummary() : null])->values()->all(),
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
            'deletedAt' => optional($this->deleted_at)->toApiString(),
        ]);
    }
}
