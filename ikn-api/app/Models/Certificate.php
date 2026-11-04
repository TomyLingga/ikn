<?php

namespace App\Models;

use App\Support\HasTranslations;

class Certificate extends Model
{
    use HasTranslations;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_EXPIRED, self::STATUS_IN_PROGRESS];

    protected $fillable = [
        'name', 'material', 'description', 'number', 'issuer', 'accreditation', 'standard', 'status',
        'media_id', 'logo_media_id', 'is_published', 'sort_order',
    ];

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
