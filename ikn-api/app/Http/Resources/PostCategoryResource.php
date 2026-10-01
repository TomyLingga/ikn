<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PostCategoryResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'sortOrder' => $this->sort_order,
            // withCount('posts'): admin = semua berita, publik = hanya yang terbit.
            'postCount' => $this->posts_count ?? null,
        ];
    }
}
