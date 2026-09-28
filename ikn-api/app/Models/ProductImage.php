<?php

namespace App\Models;

class ProductImage extends Model
{
    protected $fillable = ['product_id', 'media_id', 'sort_order'];

    protected $casts = ['sort_order' => 'integer'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    /** Bentuk kontrak bagian 6: { id, url, sort }. */
    public function toSummary(): array
    {
        return [
            'id' => $this->media_id,
            'url' => $this->media ? $this->media->url() : null,
            'sort' => $this->sort_order,
        ];
    }
}
