<?php

namespace App\Models;

use App\Support\HasTranslations;
use Illuminate\Database\Eloquent\Builder;

/**
 * Syarat pembayaran (ASUMSI A-87): master kecil yang dikelola admin, dipilih customer ekspor saat checkout dan
 * dibekukan ke orders.payment_term_code + payment_term_snapshot. Informasi untuk dokumen; aplikasi tetap memproses
 * satu pembayaran sebesar grand total (pembayaran bertahap tidak dimodelkan).
 */
class PaymentTerm extends Model
{
    use HasTranslations;

    public const MARKET_LOCAL = 'local';
    public const MARKET_EXPORT = 'export';
    public const MARKETS = [self::MARKET_LOCAL, self::MARKET_EXPORT];

    protected $fillable = ['code', 'name', 'description', 'market', 'is_active', 'sort_order'];

    protected $translatable = ['name', 'description'];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function orders()
    {
        return $this->hasMany(Order::class, 'payment_term_code', 'code');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeForMarket(Builder $query, string $market): Builder
    {
        return $query->where('market', $market);
    }

    /** Bentuk publik (GET /commerce/config, QuoteResult.paymentTerm). */
    public function toPublicArray(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'market' => $this->market,
        ];
    }

    /** Snapshot yang dibekukan ke order saat checkout. */
    public function toSnapshot(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
        ];
    }
}
