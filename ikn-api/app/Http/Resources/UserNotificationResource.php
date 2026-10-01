<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

// Notifikasi dalam aplikasi: title/body dua bahasa ({id,en}), url = path FE tujuan.
class UserNotificationResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'data' => $this->data,
            'read' => $this->read_at !== null,
            'readAt' => optional($this->read_at)->toApiString(),
            'createdAt' => optional($this->created_at)->toApiString(),
        ];
    }
}
