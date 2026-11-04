<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Resources\Json\JsonResource;

// Bentuk produk untuk panel admin: superset ProductResource (selalu rupiah) + promo mentah, harga USD (sen, ASUMSI A-86),
// reserved, isPublished, timestamp.
class AdminProductResource extends JsonResource
{
    public function toArray($request): array
    {
        $public = (new ProductResource($this->resource))->toArray($request);
        $images = $this->relationLoaded('images') ? $this->images : $this->images()->with('media')->get();

        return array_merge($public, [
            'categoryId' => $this->category_id,
            'category' => $this->category ? $this->category->toSummary() : null,
            // Pabrik asal (ASUMSI A-90): id tersimpan (null = ikut pabrik bawaan) + pabrik efektif { id, code, name }.
            'factoryLocationId' => $this->factory_location_id === null ? null : (int) $this->factory_location_id,
            'factoryLocation' => optional($this->resource->factoryLocation())->toSummary(),
            'currency' => Money::CURRENCY_IDR,
            'price' => $this->priceInt(),
            'promoPrice' => $this->promo_price === null ? null : Money::toInt($this->promo_price),
            'promoStartsAt' => optional($this->promo_starts_at)->toApiString(),
            'promoEndsAt' => optional($this->promo_ends_at)->toApiString(),
            'promoActive' => $this->promoActive(),
            'effectivePrice' => $this->effectivePrice(),
            // Harga USD per satuan dalam sen (1250 = USD 12,50), basis FOB Belawan; null = belum dijual ke pasar ekspor.
            'priceUsd' => $this->priceUsdMinor(),
            'priceUsdSet' => $this->price_usd !== null && $this->isFixedPrice(),
            'reserved' => (int) $this->reserved_qty,
            'isPublished' => $this->is_published,
            'thumbnailMediaId' => optional($this->thumbnailImage())->media_id,
            'images' => $images->map(fn ($image) => $image->toSummary() + ['mediaId' => $image->media_id, 'media' => $image->media ? $image->media->toSummary() : null])->values()->all(),
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
            'deletedAt' => optional($this->deleted_at)->toApiString(),
        ]);
    }
}
