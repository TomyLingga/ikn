<?php

namespace App\Models;

use App\Support\Money;

/**
 * Percobaan bayar (state machine 7.2). Satu order boleh punya banyak payment; hanya satu yang aktif
 * (pending/awaiting_verification) pada satu waktu. Status diubah hanya lewat App\Services\Payment\PaymentService
 * dan OrderStateMachine (expired/cancelled mengikuti order).
 */
class Payment extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_AWAITING_VERIFICATION = 'awaiting_verification';
    public const STATUS_PAID = 'paid';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_PENDING, self::STATUS_AWAITING_VERIFICATION, self::STATUS_PAID, self::STATUS_REJECTED,
        self::STATUS_EXPIRED, self::STATUS_FAILED, self::STATUS_CANCELLED,
    ];

    public const ACTIVE_STATUSES = [self::STATUS_PENDING, self::STATUS_AWAITING_VERIFICATION];

    protected $guarded = [];

    protected $casts = [
        'payload' => 'array',
        'expires_at' => 'datetime',
        'paid_at' => 'datetime',
        'proof_uploaded_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function paymentMethod()
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function bankAccount()
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function proof()
    {
        return $this->belongsTo(Media::class, 'proof_media_id');
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by')->withTrashed();
    }

    public function webhookLogs()
    {
        return $this->hasMany(PaymentWebhookLog::class);
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    public function isManual(): bool
    {
        return $this->provider === PaymentMethod::DRIVER_MANUAL;
    }

    public function amountInt(): int
    {
        return Money::toInt($this->amount);
    }

    /** external_id yang dikirim ke gateway/webhook: "{order.number}-{payment.id}". */
    public static function externalIdFor(Order $order, int $paymentId): string
    {
        return $order->number.'-'.$paymentId;
    }
}
