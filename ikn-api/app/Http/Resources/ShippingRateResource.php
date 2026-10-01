<?php

namespace App\Http\Resources;

use App\Models\ShippingRate;
use App\Support\Money;
use Illuminate\Http\Resources\Json\JsonResource;

// Tarif ongkir: dipakai di /admin/shipping-zones/{id}/rates dan alias /admin/shipping-methods (label + zone).
class ShippingRateResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'zoneId' => $this->zone_id,
            'zone' => $this->whenLoaded('zone', fn () => $this->zone ? ['id' => $this->zone->id, 'name' => $this->zone->name] : null),
            'name' => $this->name,
            'label' => $this->name,
            'type' => $this->isCalculated() ? ShippingRate::TYPE_CALCULATED : ShippingRate::TYPE_FLAT,
            'baseAmount' => Money::toInt($this->base_amount),
            'perKmAmount' => Money::toInt($this->per_km_amount),
            'perKgAmount' => Money::toInt($this->per_kg_amount),
            'perM3Amount' => Money::toInt($this->per_m3_amount),
            'minAmount' => Money::toInt($this->min_amount),
            'freeAbove' => $this->free_above === null ? null : Money::toInt($this->free_above),
            'eta' => $this->eta,
            'isActive' => $this->is_active,
            'sortOrder' => $this->sort_order,
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
