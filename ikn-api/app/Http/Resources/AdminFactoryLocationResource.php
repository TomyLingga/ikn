<?php

namespace App\Http\Resources;

use App\Models\FactoryLocation;
use App\Services\Commerce\FactoryLocations;
use Illuminate\Http\Resources\Json\JsonResource;

// Bentuk admin lokasi pabrik (kontrak 11.8, ASUMSI A-90): bentuk publik + id, sortOrder, isDefault, productsCount, waktu.
class AdminFactoryLocationResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var FactoryLocation $factory */
        $factory = $this->resource;

        return ['id' => $factory->id] + $factory->toPublicArray() + [
            'sortOrder' => (int) $factory->sort_order,
            // Urutan pertama = pabrik bawaan untuk produk tanpa pabrik.
            'isDefault' => optional(app(FactoryLocations::class)->default())->id === $factory->id,
            'productsCount' => (int) ($factory->products_count ?? $factory->products()->count()),
            'createdAt' => optional($factory->created_at)->toApiString(),
            'updatedAt' => optional($factory->updated_at)->toApiString(),
        ];
    }
}
