<?php

namespace App\Models;

use App\Support\HasTranslations;

class Category extends Model
{
    use HasTranslations;

    protected $fillable = ['slug', 'name', 'description', 'image_media_id', 'sort_order', 'is_active'];

    protected $translatable = ['name', 'description'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function image()
    {
        return $this->belongsTo(Media::class, 'image_media_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /** Bentuk ringkas untuk disematkan di produk (kontrak bagian 6). */
    public function toSummary(): array
    {
        return ['id' => $this->id, 'slug' => $this->slug, 'name' => $this->name];
    }
}
