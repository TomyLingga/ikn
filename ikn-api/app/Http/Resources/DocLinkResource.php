<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class DocLinkResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'label' => $this->label,
            'description' => $this->description,
            'file' => $this->media ? $this->media->toSummary() : null,
            'url' => $this->url,
            'targetUrl' => $this->targetUrl(),
            'isActive' => $this->is_active,
            'sortOrder' => $this->sort_order,
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
