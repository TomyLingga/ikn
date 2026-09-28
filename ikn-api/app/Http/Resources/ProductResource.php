<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Resources\Json\JsonResource;

// Bentuk produk publik (kontrak bagian 6, superset tipe Product FE). Uang integer rupiah.
class ProductResource extends JsonResource
{
    public function toArray($request): array
    {
        $promoActive = $this->promoActive();
        $images = $this->relationLoaded('images') ? $this->images : $this->images()->with('media')->get();

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'code' => $this->code,
            'name' => $this->name,
            'category' => $this->category ? ['slug' => $this->category->slug, 'name' => $this->category->name] : null,
            'kind' => $this->kind,
            'priceMode' => $this->price_mode,
            'price' => $this->priceInt(),
            'promoPrice' => $promoActive ? Money::toInt($this->promo_price) : null,
            'promoEndsAt' => $promoActive && $this->promo_ends_at ? $this->promo_ends_at->toApiString() : null,
            'effectivePrice' => $this->effectivePrice(),
            'unit' => $this->unit,
            'moq' => $this->moq,
            'weightGram' => $this->weight_gram,
            'stock' => (int) $this->stock_qty,
            'available' => $this->available,
            'stockStatus' => $this->stock_status,
            'isTaxable' => $this->is_taxable,
            'images' => $images->map(fn ($image) => $image->toSummary())->values()->all(),
            'image' => $images->first() && $images->first()->media ? $images->first()->media->url() : null,
            'summary' => $this->summary,
            'highlights' => $this->highlights,
            'specs' => $this->specs ?? [],
            'applications' => $this->applications,
            'solubility' => $this->solubility ?? [],
            'aliases' => $this->aliases ?? [],
            'ratingAvg' => (float) $this->rating_avg,
            'reviewCount' => (int) $this->review_count,
        ];
    }
}
