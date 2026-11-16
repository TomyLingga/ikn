<?php

namespace App\Models;

use App\Services\Commerce\InstallmentSchedule;
use App\Support\HasTranslations;
use Illuminate\Database\Eloquent\Builder;

/**
 * Syarat pembayaran (ASUMSI A-87): master kecil yang dikelola admin, dipilih customer ekspor saat checkout dan
 * dibekukan ke orders.payment_term_code + payment_term_snapshot. Kolom `installments` (ASUMSI A-97) = jadwal termin:
 * kosong berarti satu pembayaran sebesar grand total; terisi berarti order ditagih bertahap (order_installments).
 */
class PaymentTerm extends Model
{
    use HasTranslations;

    public const MARKET_LOCAL = 'local';
    public const MARKET_EXPORT = 'export';
    public const MARKETS = [self::MARKET_LOCAL, self::MARKET_EXPORT];

    protected $fillable = ['code', 'name', 'description', 'installments', 'market', 'is_active', 'sort_order'];

    protected $translatable = ['name', 'description'];

    protected $casts = [
        'installments' => 'array',
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

    /** Jadwal termin selalu disimpan dalam bentuk ternormalisasi; kosong atau satu baris = null (bayar penuh). */
    public function setInstallmentsAttribute($value): void
    {
        $rows = InstallmentSchedule::normalize($value);
        $this->attributes['installments'] = $rows === null ? null : json_encode($rows, JSON_UNESCAPED_UNICODE);
    }

    /**
     * Jadwal termin (ASUMSI A-97) atau [] bila syarat ini satu pembayaran penuh.
     *
     * @return array<int, array{key:string, label:array, percent:int|float, trigger:string, dueDays:int}>
     */
    public function installmentRows(): array
    {
        return InstallmentSchedule::normalize($this->installments) ?? [];
    }

    public function hasInstallments(): bool
    {
        return $this->installmentRows() !== [];
    }

    /** Bentuk publik (GET /commerce/config, QuoteResult.paymentTerm). */
    public function toPublicArray(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'market' => $this->market,
            'installments' => $this->installmentRows(),
        ];
    }

    /** Snapshot yang dibekukan ke order saat checkout. */
    public function toSnapshot(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'installments' => $this->installmentRows(),
        ];
    }
}
