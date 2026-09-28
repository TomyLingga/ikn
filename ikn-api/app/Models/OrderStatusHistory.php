<?php

namespace App\Models;

// Timeline order: satu baris per transisi OrderStateMachine (from_status null = order dibuat).
class OrderStatusHistory extends Model
{
    public const ACTOR_USER = 'user';
    public const ACTOR_SYSTEM = 'system';
    public const ACTOR_WEBHOOK = 'webhook';
    public const ACTOR_TYPES = [self::ACTOR_USER, self::ACTOR_SYSTEM, self::ACTOR_WEBHOOK];

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['meta' => 'array', 'created_at' => 'datetime'];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id')->withTrashed();
    }
}
