<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class StockMovementResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'productId' => $this->product_id,
            'type' => $this->type,
            'qty' => $this->qty,
            'referenceType' => $this->reference_type,
            'referenceId' => $this->reference_id,
            'idempotencyKey' => $this->idempotency_key,
            'note' => $this->note,
            'createdBy' => $this->whenLoaded('creator', fn () => $this->creator ? ['id' => $this->creator->id, 'name' => $this->creator->name] : null, null),
            'createdAt' => optional($this->created_at)->toApiString(),
        ];
    }
}
