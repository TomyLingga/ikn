<?php

namespace App\Models;

// Pesan live chat. Isi, tanda edit/tarik, dan revisi hanya ditulis App\Services\Chat\ChatService (ASUMSI A-73, A-99).
// Baris tidak pernah dihapus: pesan yang ditarik tetap tersimpan dengan retracted_at, API tidak mengirim isinya.
class ChatMessage extends Model
{
    public const ROLE_CUSTOMER = 'customer';
    public const ROLE_ADMIN = 'admin';
    public const ROLES = [self::ROLE_CUSTOMER, self::ROLE_ADMIN];

    public const CONTEXT_PRODUCT = 'product';
    public const CONTEXT_ORDER = 'order';
    public const CONTEXT_TYPES = [self::CONTEXT_PRODUCT, self::CONTEXT_ORDER];

    public const BODY_MAX = 2000;

    protected $fillable = ['conversation_id', 'sender_id', 'sender_role', 'body', 'context', 'revision'];

    protected $hidden = ['edit_history'];

    protected $casts = [
        'context' => 'array',
        'edit_history' => 'array',
        'revision' => 'integer',
        'edited_at' => 'datetime',
        'retracted_at' => 'datetime',
    ];

    public function conversation()
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id')->withTrashed();
    }

    public function isRetracted(): bool
    {
        return $this->retracted_at !== null;
    }
}
