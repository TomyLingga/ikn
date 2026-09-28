<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class MediaResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url(),
            'disk' => $this->disk,
            'mime' => $this->mime,
            'size' => $this->size,
            'originalName' => $this->original_name,
            'collection' => $this->collection,
            'isImage' => $this->isImage(),
            'meta' => $this->meta,
            'createdAt' => optional($this->created_at)->toApiString(),
        ];
    }
}
