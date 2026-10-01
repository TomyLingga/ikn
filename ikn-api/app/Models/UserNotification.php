<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;

// Notifikasi dalam aplikasi (lonceng portal customer, ASUMSI A-71). Dibuat hanya lewat App\Services\Notification\InAppNotifier.
class UserNotification extends Model
{
    protected $fillable = ['user_id', 'type', 'title', 'body', 'url', 'data', 'read_at'];

    protected $casts = [
        'title' => 'array',
        'body' => 'array',
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
    }
}
