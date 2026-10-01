<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'excerpt' => $this->excerpt,
            'body' => $this->when(! $request->boolean('summary'), $this->body),
            'category' => $this->category
                ? ['id' => $this->category->id, 'slug' => $this->category->slug, 'name' => $this->category->name]
                : null,
            'author' => $this->author,
            'readingMinutes' => $this->readingMinutes(),
            'cover' => $this->cover ? $this->cover->toSummary() : null,
            'isPublished' => $this->is_published,
            'publishedAt' => optional($this->published_at)->toApiString(),
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
