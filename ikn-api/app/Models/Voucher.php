<?php

namespace App\Models;

use App\Models\Concerns\HasCustomerAudience;
use App\Support\Money;

class Voucher extends Model
{
    use HasCustomerAudience;

    public const AUDIENCE_ALL = 'all';
    public const AUDIENCE_CUSTOMERS = 'customers';
    public const AUDIENCES = [self::AUDIENCE_ALL, self::AUDIENCE_CUSTOMERS];
    public const AUDIENCE_PIVOT = 'voucher_customers';
    public const AUDIENCE_KEY = 'voucher_id';

    public const TYPE_PERCENT = 'percent';
    public const TYPE_FIXED = 'fixed';
    public const TYPES = [self::TYPE_PERCENT, self::TYPE_FIXED];

    public const SCOPE_ALL = 'all';
    public const SCOPE_CATEGORY = 'category';
    public const SCOPES = [self::SCOPE_ALL, self::SCOPE_CATEGORY];

    protected $fillable = [
        'code', 'type', 'value', 'min_subtotal', 'max_discount', 'quota', 'used_count',
        'per_user_limit', 'scope', 'starts_at', 'ends_at', 'is_active', 'audience',
    ];

    protected $casts = [
        'scope' => 'array',
        'quota' => 'integer',
        'used_count' => 'integer',
        'per_user_limit' => 'integer',
        'is_active' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    // Kode selalu huruf besar tanpa spasi.
    public function setCodeAttribute(?string $value): void
    {
        $this->attributes['code'] = strtoupper(trim((string) $value));
    }

    public function usages()
    {
        return $this->hasMany(VoucherUsage::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function discountScope(): string
    {
        return $this->scope['type'] ?? self::SCOPE_ALL;
    }

    /** @return int[] */
    public function discountCategoryIds(): array
    {
        return array_values(array_map('intval', $this->scope['categoryIds'] ?? []));
    }

    public function appliesToAll(): bool
    {
        return $this->discountScope() !== self::SCOPE_CATEGORY || $this->discountCategoryIds() === [];
    }

    public function minSubtotalInt(): int
    {
        return Money::toInt($this->min_subtotal);
    }

    public function maxDiscountInt(): ?int
    {
        return $this->max_discount === null ? null : Money::toInt($this->max_discount);
    }

    /** Nilai voucher: persen (float) untuk percent, rupiah bulat untuk fixed. */
    public function valueNumber()
    {
        return $this->type === self::TYPE_PERCENT ? (float) $this->value : Money::toInt($this->value);
    }

    /** Bentuk ringkas untuk quote/order: { code, type, value }. */
    public function toSummary(): array
    {
        return ['id' => $this->id, 'code' => $this->code, 'type' => $this->type, 'value' => $this->valueNumber()];
    }
}
