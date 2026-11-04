<?php

namespace App\Http\Resources;

use App\Models\PaymentTerm;
use Illuminate\Http\Resources\Json\JsonResource;

// Bentuk admin syarat pembayaran (kontrak 11.10): bentuk publik + id, isActive, sortOrder, ordersCount, waktu.
class AdminPaymentTermResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var PaymentTerm $term */
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
