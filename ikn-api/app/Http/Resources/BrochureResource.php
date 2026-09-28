<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class BrochureResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'file' => $this->media ? $this->media->toSummary() : null,
            'isPublished' => $this->is_published,
            'sortOrder' => $this->sort_order,
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
