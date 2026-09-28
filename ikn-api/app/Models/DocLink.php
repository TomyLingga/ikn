<?php

namespace App\Models;

use App\Support\HasTranslations;

class DocLink extends Model
{
    use HasTranslations;

    public const CATEGORY_WBS = 'wbs';

    protected $fillable = ['category', 'label', 'description', 'media_id', 'url', 'is_active', 'sort_order'];

    protected $translatable = ['label', 'description'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // URL efektif: file media bila ada, selain itu tautan eksternal.
    public function targetUrl(): ?string
    {
        if ($this->media) {
            return $this->media->url();
        }

        return $this->url;
    }
}
