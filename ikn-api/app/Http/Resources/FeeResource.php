<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class FeeResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'amount' => $this->amountInt(),
            'isActive' => $this->is_active,
            'sortOrder' => $this->sort_order,
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
