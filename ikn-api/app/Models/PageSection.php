<?php

namespace App\Models;

class PageSection extends Model
{
    protected $fillable = ['page_id', 'key', 'type', 'sort_order', 'content', 'is_visible'];

    protected $casts = ['content' => 'array', 'is_visible' => 'boolean', 'sort_order' => 'integer'];

    public function page()
    {
        return $this->belongsTo(Page::class);
    }

    public function scopeVisible($query)
    {
        return $query->where('is_visible', true);
    }
}
