<?php

namespace App\Models;

class CustomerLogo extends Model
{
    protected $fillable = ['name', 'media_id', 'url', 'is_active', 'sort_order'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
