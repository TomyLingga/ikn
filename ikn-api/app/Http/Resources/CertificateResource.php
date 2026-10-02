<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CertificateResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'material' => $this->material,
            'description' => $this->description,
            'file' => $this->media ? $this->media->toSummary() : null,
            'logo' => $this->logo ? $this->logo->toSummary() : null,
            'isPublished' => $this->is_published,
            'sortOrder' => $this->sort_order,
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
