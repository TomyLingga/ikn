<?php

namespace App\Models;

// Media produk (foto atau video, ASUMSI A-72). Nama tabel/kelas tetap "image" agar kontrak `images[]` tidak berubah.
class ProductImage extends Model
{
    public const TYPE_IMAGE = 'image';
    public const TYPE_VIDEO = 'video';

    protected $fillable = ['product_id', 'media_id', 'sort_order', 'is_thumbnail'];

    protected $casts = ['sort_order' => 'integer', 'is_thumbnail' => 'boolean'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    public function isVideo(): bool
    {
        return (bool) ($this->media && $this->media->isVideo());
    }

    /** Bentuk kontrak bagian 6: { id, url, sort } + type (image|video), mime, isThumbnail. */
    public function toSummary(): array
    {
        return [
            'id' => $this->media_id,
            'url' => $this->media ? $this->media->url() : null,
            'sort' => $this->sort_order,
            'type' => $this->isVideo() ? self::TYPE_VIDEO : self::TYPE_IMAGE,
            'mime' => $this->media?->mime,
            'isThumbnail' => (bool) $this->is_thumbnail,
        ];
    }
}
