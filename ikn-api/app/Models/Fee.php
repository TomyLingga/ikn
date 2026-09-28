<?php

namespace App\Models;

use App\Support\HasTranslations;
use App\Support\Money;

class Fee extends Model
{
    use HasTranslations;

    public const TYPE_ADMIN = 'admin';
    public const TYPE_OTHER = 'other';
    public const TYPES = [self::TYPE_ADMIN, self::TYPE_OTHER];

    protected $fillable = ['name', 'type', 'amount', 'is_active', 'sort_order'];

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
