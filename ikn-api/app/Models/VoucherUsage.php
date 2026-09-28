<?php

namespace App\Models;

// Pemakaian voucher per order (kuota di-reserve saat checkout, commit saat paid, release saat expired/cancelled).
class VoucherUsage extends Model
{
    public const STATUS_RESERVED = 'reserved';
    public const STATUS_COMMITTED = 'committed';
    public const STATUS_RELEASED = 'released';
    public const STATUSES = [self::STATUS_RESERVED, self::STATUS_COMMITTED, self::STATUS_RELEASED];

    protected $fillable = ['voucher_id', 'user_id', 'order_id', 'status'];

    protected $casts = ['order_id' => 'integer'];

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
