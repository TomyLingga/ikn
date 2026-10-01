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
        if (! $this->relationLoaded('images')) {
            $this->resource->setRelation('images', $this->images()->with('media')->get());
        }
        $images = $this->images;

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
            // Dimensi kemasan per satuan (cm) + volume cm³ untuk ongkir (ASUMSI A-76).
            'dimensions' => $this->dimensions(),
            'stock' => (int) $this->stock_qty,
            'available' => $this->available,
            'stockStatus' => $this->stock_status,
            'isTaxable' => $this->is_taxable,
            'images' => $images->map(fn ($image) => $image->toSummary())->values()->all(),
            // Thumbnail pilihan admin (atau foto pertama); video tidak pernah menjadi thumbnail (ASUMSI A-72).
            'image' => $this->primaryImageUrl(),
            'hasVideo' => $images->contains(fn ($image) => $image->isVideo()),
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
