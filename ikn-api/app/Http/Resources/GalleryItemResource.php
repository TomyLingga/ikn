<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class GalleryItemResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->type,
            'media' => $this->media ? $this->media->toSummary() : null,
            'externalUrl' => $this->external_url,
            'youtubeId' => self::youtubeId($this->external_url),
            'isPublished' => $this->is_published,
            'sortOrder' => $this->sort_order,
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }

    // Terima ID mentah, youtu.be/ID, atau youtube.com/watch?v=ID.
    public static function youtubeId(?string $value): ?string
    {
        if (! $value) {
            return null;
        }
        if (preg_match('~(?:youtu\.be/|v=|/embed/|/shorts/)([A-Za-z0-9_-]{6,})~', $value, $m)) {
            return $m[1];
        }

        return preg_match('~^[A-Za-z0-9_-]{6,}$~', $value) ? $value : null;
    }
}
