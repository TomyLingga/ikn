<?php

namespace App\Models;

use App\Models\Concerns\HasCustomerAudience;
use App\Support\HasTranslations;
use App\Support\Money;

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

    protected $fillable = ['name', 'type', 'amount', 'is_active', 'sort_order', 'audience'];

    protected $translatable = ['name'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function amountInt(): int
    {
        return Money::toInt($this->amount);
    }
}
