<?php

namespace App\Models;

use App\Support\Money;

// Kurs harian USD/IDR (ASUMSI A-84): sumber JISDOR (BI) atau manual admin, satu baris per (date, currency).
class ExchangeRate extends Model
{
    public const SOURCE_JISDOR = 'jisdor';

    public const SOURCE_MANUAL = 'manual';

    public const SOURCES = [self::SOURCE_JISDOR, self::SOURCE_MANUAL];

    public const CURRENCY_USD = 'USD';

    protected $fillable = ['date', 'currency', 'rate', 'source', 'fetched_at'];

    protected $casts = ['date' => 'date:Y-m-d', 'fetched_at' => 'datetime'];

    /** JISDOR adalah rupiah bulat; JSON tetap integer rupiah (kontrak bagian 1). */
    public function rateInt(): int
    {
        return Money::toInt($this->rate);
    }

    /** Baris deret untuk kartu kurs admin. */
    public function toSummary(): array
    {
        return [
            'date' => $this->date->format('Y-m-d'),
            'rate' => $this->rateInt(),
            'source' => $this->source,
        ];
    }
}
