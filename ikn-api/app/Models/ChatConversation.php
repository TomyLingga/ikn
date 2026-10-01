<?php

namespace App\Models;

// Percakapan live chat: satu per customer, atau tamu (user_id null + guest_token) yang belum login (ASUMSI A-73).
// Penghitung dan pratinjau hanya ditulis App\Services\Chat\ChatService.
class ChatConversation extends Model
{
    protected $fillable = ['user_id', 'guest_token', 'guest_name', 'guest_email', 'guest_phone'];

    protected $hidden = ['guest_token'];

    protected $casts = [
        'customer_unread' => 'integer',
        'admin_unread' => 'integer',
        'last_message_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    public function messages()
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id')->orderBy('id');
    }

    public function isGuest(): bool
    {
        return $this->user_id === null;
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
