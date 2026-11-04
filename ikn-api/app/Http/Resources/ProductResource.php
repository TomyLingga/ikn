<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Support\Money;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bentuk produk publik (kontrak bagian 6, superset tipe Product FE). Uang integer satuan terkecil `currency`
 * (ASUMSI A-86): pengunjung umum/customer lokal melihat harga rupiah; customer ekspor yang login melihat `priceUsd`
 * (sen, basis FOB Belawan) dan field rupiah dihilangkan. Tamu dan mesin pencari tidak pernah melihat harga USD.
 */
class ProductResource extends JsonResource
{
    private const VIEWER_KEY = 'ikn.export_viewer';

    /** Apakah pengunjung request ini customer ekspor yang login (dihitung sekali per request, disimpan di atribut request). */
    public static function exportViewer(): bool
    {
        $request = request();
        if (! $request->attributes->has(self::VIEWER_KEY)) {
            $viewer = auth('sanctum')->user();
            $request->attributes->set(self::VIEWER_KEY, $viewer instanceof User && $viewer->isCustomer() && $viewer->isExport());
        }

        return (bool) $request->attributes->get(self::VIEWER_KEY);
    }

    public function toArray($request): array
    {
        $promoActive = $this->promoActive();
        if (! $this->relationLoaded('images')) {
            $this->resource->setRelation('images', $this->images()->with('media')->get());
        }
        $images = $this->images;
        $export = self::exportViewer();

        $prices = $export
            ? [
                'currency' => Money::CURRENCY_USD,
                'priceUsd' => $this->priceUsdMinor(),
            ]
            : [
                'currency' => Money::CURRENCY_IDR,
                'price' => $this->priceInt(),
                'promoPrice' => $promoActive ? Money::toInt($this->promo_price) : null,
                'promoEndsAt' => $promoActive && $this->promo_ends_at ? $this->promo_ends_at->toApiString() : null,
                'effectivePrice' => $this->effectivePrice(),
            ];

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'code' => $this->code,
            'name' => $this->name,
            'category' => $this->category ? ['slug' => $this->category->slug, 'name' => $this->category->name] : null,
            'kind' => $this->kind,
            // Pabrik asal (ASUMSI A-90): { code, name }; menentukan titik ambil Loco dan asal ongkir.
            'factory' => optional($this->resource->factoryLocation())->toBrief(),
            'priceMode' => $this->price_mode,
        ] + $prices + [
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
