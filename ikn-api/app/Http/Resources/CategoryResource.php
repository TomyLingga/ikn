<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'image' => $this->whenLoaded('image', fn () => $this->image ? $this->image->toSummary() : null, null),
            'sortOrder' => $this->sort_order,
            'isActive' => $this->is_active,
            'productCount' => $this->when($this->products_count !== null, (int) $this->products_count),
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
