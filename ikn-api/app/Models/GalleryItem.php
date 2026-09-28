<?php

namespace App\Models;

use App\Support\HasTranslations;

class GalleryItem extends Model
{
    use HasTranslations;

    public const TYPE_IMAGE = 'image';
    public const TYPE_VIDEO = 'video';
    public const TYPES = [self::TYPE_IMAGE, self::TYPE_VIDEO];

    protected $fillable = ['title', 'type', 'media_id', 'external_url', 'is_published', 'sort_order'];

    protected $translatable = ['title'];

    protected $casts = ['is_published' => 'boolean', 'sort_order' => 'integer'];

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }
}
