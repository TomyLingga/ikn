<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

// Bentuk admin: config apa adanya (hanya kunci non-rahasia) + qrisImageUrl terhidrasi. Bentuk publik: PaymentMethod::toPublicArray().
class PaymentMethodResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'type' => $this->type,
            'driver' => $this->driver,
            'name' => $this->name,
            'instructions' => $this->instructions,
            'config' => $this->config ?? (object) [],
            'qrisImageUrl' => $this->qrisImageUrl(),
            'isActive' => $this->is_active,
            'sortOrder' => $this->sort_order,
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
