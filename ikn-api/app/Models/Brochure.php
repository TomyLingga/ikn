<?php

namespace App\Models;

use App\Support\HasTranslations;

class Brochure extends Model
{
    use HasTranslations;

    protected $fillable = ['title', 'description', 'media_id', 'is_published', 'sort_order'];

    protected $translatable = ['title', 'description'];

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
