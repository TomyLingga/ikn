<?php

namespace App\Models;

class WbsReport extends Model
{
    public const STATUS_NEW = 'new';
    public const STATUS_REVIEW = 'review';
    public const STATUS_CLOSED = 'closed';
    public const STATUSES = [self::STATUS_NEW, self::STATUS_REVIEW, self::STATUS_CLOSED];

    protected $fillable = [
        'code', 'subject', 'body', 'reporter_name', 'reporter_contact', 'is_anonymous',
        'attachment_media_id', 'status', 'handled_by', 'admin_notes',
    ];

    protected $casts = ['is_anonymous' => 'boolean'];

    public function attachment()
    {
        return $this->belongsTo(Media::class, 'attachment_media_id');
    }

    public function handler()
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}
