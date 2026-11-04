<?php

namespace App\Http\Resources;

use App\Models\DeliveryTerm;
use Illuminate\Http\Resources\Json\JsonResource;

// Bentuk admin cara serah terima (kontrak 11.8): bentuk publik + id, isActive, sortOrder, ordersCount, waktu.
class AdminDeliveryTermResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var DeliveryTerm $term */
        $term = $this->resource;

        return ['id' => $term->id] + $term->toPublicArray() + [
            'isActive' => (bool) $term->is_active,
            'sortOrder' => (int) $term->sort_order,
            'ordersCount' => $this->when($term->orders_count !== null, fn () => (int) $term->orders_count),
            'createdAt' => optional($term->created_at)->toApiString(),
            'updatedAt' => optional($term->updated_at)->toApiString(),
        ];
    }
}
