<?php

namespace App\Models;

class ContactMessage extends Model
{
    public const TYPE_CONTACT = 'contact';
    public const TYPE_QUOTE = 'quote';
    public const TYPES = [self::TYPE_CONTACT, self::TYPE_QUOTE];

    protected $fillable = ['type', 'name', 'email', 'phone', 'subject', 'message', 'meta', 'read_at'];

    protected $casts = ['meta' => 'array', 'read_at' => 'datetime'];

    public function setEmailAttribute(?string $value): void
    {
        $this->attributes['email'] = $value === null ? null : strtolower(trim($value));
    }
}
