<?php

namespace App\Models;

use App\Support\HasTranslations;

class Post extends Model
{
    use HasTranslations;

    protected $fillable = ['slug', 'title', 'excerpt', 'body', 'tag', 'author', 'cover_media_id', 'is_published', 'published_at'];

    protected $translatable = ['title', 'excerpt', 'body'];

    protected $casts = ['is_published' => 'boolean', 'published_at' => 'datetime'];

    /** Estimasi menit baca dari isi bahasa Indonesia. */
    public function readingMinutes(): int
    {
        return \App\Support\Html::readingMinutes($this->body['id'] ?? '');
    }

    public function cover()
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true)
            ->where(function ($q) {
                $q->whereNull('published_at')->orWhere('published_at', '<=', now());
            });
    }
}
