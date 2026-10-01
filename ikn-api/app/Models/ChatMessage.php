<?php

namespace App\Models;

class ChatMessage extends Model
{
    public const ROLE_CUSTOMER = 'customer';
    public const ROLE_ADMIN = 'admin';
    public const ROLES = [self::ROLE_CUSTOMER, self::ROLE_ADMIN];

    public const CONTEXT_PRODUCT = 'product';
    public const CONTEXT_ORDER = 'order';
    public const CONTEXT_TYPES = [self::CONTEXT_PRODUCT, self::CONTEXT_ORDER];

    public const BODY_MAX = 2000;

    protected $fillable = ['conversation_id', 'sender_id', 'sender_role', 'body', 'context'];

    protected $casts = ['context' => 'array'];

    public function conversation()
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id')->withTrashed();
    }
}
