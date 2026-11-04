<?php

namespace App\Models;

use App\Models\Concerns\HasCustomerAudience;
use App\Support\HasTranslations;
use App\Support\Money;

// Biaya tambahan per order. Punya mata uang (ASUMSI A-86): hanya fee se-mata-uang dengan order yang dikenakan.
class Fee extends Model
{
    use HasCustomerAudience, HasTranslations;

    public const AUDIENCE_ALL = 'all';
    public const AUDIENCE_CUSTOMERS = 'customers';
    public const AUDIENCES = [self::AUDIENCE_ALL, self::AUDIENCE_CUSTOMERS];
    public const AUDIENCE_PIVOT = 'fee_customers';
    public const AUDIENCE_KEY = 'fee_id';

    public const TYPE_ADMIN = 'admin';
    public const TYPE_OTHER = 'other';
    public const TYPES = [self::TYPE_ADMIN, self::TYPE_OTHER];

    protected $fillable = ['name', 'type', 'amount', 'currency', 'is_active', 'sort_order', 'audience'];

    protected $translatable = ['name'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForCurrency($query, string $currency)
    {
        return $query->where('currency', Money::normalizeCurrency($currency));
    }

    public function currencyCode(): string
    {
        return Money::normalizeCurrency($this->currency);
    }

    /** Nominal dalam satuan terkecil mata uang fee. */
    public function amountInt(): int
    {
        return Money::toMinor($this->amount, $this->currencyCode()) ?? 0;
    }
}
