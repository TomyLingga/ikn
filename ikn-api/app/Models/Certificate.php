<?php

namespace App\Models;

use App\Support\HasTranslations;

class Certificate extends Model
{
    use HasTranslations;

    protected $fillable = ['name', 'material', 'description', 'media_id', 'logo_media_id', 'is_published', 'sort_order'];

    protected $translatable = ['name', 'material', 'description'];

    protected $casts = ['is_published' => 'boolean', 'sort_order' => 'integer'];

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    /** Logo/lencana sertifikat (gambar), opsional. */
    public function logo()
    {
        return $this->belongsTo(Media::class, 'logo_media_id');
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }
}
