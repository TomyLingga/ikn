<?php

namespace App\Models;

// Baris ledger stok. Hanya ditulis oleh App\Services\Stock\StockLedger (arsitektur bagian 8).
class StockMovement extends Model
{
    public const TYPE_IN = 'in';
    public const TYPE_ADJUST = 'adjust';
    public const TYPE_RESERVE = 'reserve';
    public const TYPE_RELEASE = 'release';
    public const TYPE_COMMIT = 'commit';
    public const TYPES = [self::TYPE_IN, self::TYPE_ADJUST, self::TYPE_RESERVE, self::TYPE_RELEASE, self::TYPE_COMMIT];

    /** Tipe yang boleh dibuat admin lewat endpoint stok. */
    public const ADMIN_TYPES = [self::TYPE_IN, self::TYPE_ADJUST];

    public const REFERENCE_ORDER = 'order';

    public $timestamps = false;

    protected $fillable = ['product_id', 'type', 'qty', 'reference_type', 'reference_id', 'idempotency_key', 'note', 'created_by', 'created_at'];

    protected $casts = ['qty' => 'integer', 'reference_id' => 'integer', 'created_at' => 'datetime'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
