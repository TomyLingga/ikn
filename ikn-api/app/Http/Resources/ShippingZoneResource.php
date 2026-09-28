<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ShippingZoneResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'isActive' => $this->is_active,
            'isDefault' => $this->is_default,
            'priority' => $this->priority,
            'regions' => $this->whenLoaded('regions', fn () => $this->regions->map(fn ($r) => ['code' => $r->region_code, 'level' => $r->level])->values()->all()),
            'regionCount' => $this->when($this->regions_count !== null, (int) $this->regions_count),
            'rates' => $this->whenLoaded('rates', fn () => ShippingRateResource::collection($this->rates)->resolve()),
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
