<?php

namespace App\Http\Resources;

// Daftar berita tanpa body (hemat payload).
class PostSummaryResource extends PostResource
{
    public function toArray($request): array
    {
        $data = parent::toArray($request);
        unset($data['body']);

        return $data;
    }
}
