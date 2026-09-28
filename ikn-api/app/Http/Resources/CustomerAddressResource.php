<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

// Skema alamat kontrak bagian 4: snapshot + id, isDefault, timestamps.
class CustomerAddressResource extends JsonResource
{
    public function toArray($request): array
    {
        return array_merge(
            ['id' => $this->id],
            $this->resource->toSnapshot(),
            [
                'isDefault' => (bool) $this->is_default,
                'createdAt' => optional($this->created_at)->toApiString(),
                'updatedAt' => optional($this->updated_at)->toApiString(),
            ]
        );
    }
}
