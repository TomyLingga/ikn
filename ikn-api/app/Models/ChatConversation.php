<?php

namespace App\Models;

// Percakapan live chat: satu per customer, atau tamu (user_id null + guest_token) yang belum login (ASUMSI A-73).
// Penghitung, pratinjau, revisi, dan tanda arsip hanya ditulis App\Services\Chat\ChatService (ASUMSI A-99).
class ChatConversation extends Model
{
    protected $fillable = ['user_id', 'guest_token', 'guest_name', 'guest_email', 'guest_phone'];

    protected $hidden = ['guest_token'];

    protected $casts = [
        'customer_unread' => 'integer',
        'admin_unread' => 'integer',
        'revision' => 'integer',
        'last_message_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    /** Admin yang mengarsipkan percakapan ini. */
    public function archiver()
    {
        return $this->belongsTo(User::class, 'archived_by')->withTrashed();
    }

    public function messages()
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id')->orderBy('id');
    }

    public function isGuest(): bool
    {
        return $this->user_id === null;
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    /** Nama pihak customer untuk tampilan admin: nama akun, atau nama yang diisi tamu. */
    public function customerName(): ?string
    {
        if ($this->relationLoaded('customer') && $this->customer) {
            return $this->customer->name;
        }

        return $this->guest_name;
    }
}
