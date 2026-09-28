<?php

namespace App\Models;

use App\Support\HasTranslations;

class Page extends Model
{
    use HasTranslations;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PUBLISHED = 'published';
    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PUBLISHED];

    protected $fillable = ['slug', 'title', 'status', 'seo', 'template'];

    protected $translatable = ['title'];

    protected $casts = ['seo' => 'array'];

    public function sections()
    {
        return $this->hasMany(PageSection::class)->orderBy('sort_order')->orderBy('id');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function scopePublished($query)
    {
        return $query->where('status', self::STATUS_PUBLISHED);
    }
}
