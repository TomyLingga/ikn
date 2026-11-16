<?php

namespace App\Models;

use App\Services\Commerce\InstallmentSchedule;
use App\Support\HasTranslations;
use App\Support\Money;
use Illuminate\Support\Carbon;

/**
 * Termin pembayaran satu order (ASUMSI A-97): salinan jadwal syarat pembayaran yang dibekukan saat total order final.
 * Status: scheduled (pemicu belum tercapai) → due (ditagih, menunggu pembayaran) → awaiting_verification → paid;
 * void bila order dibatalkan/kedaluwarsa sebelum lunas. Terlambat (overdue) diturunkan dari `due` + `due_at` lewat.
 * Semua perubahan hanya lewat App\Services\Commerce\InstallmentService; amount decimal satuan mayor, JSON satuan terkecil.
 */
class OrderInstallment extends Model
{
    use HasTranslations;

    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_DUE = 'due';
    public const STATUS_AWAITING_VERIFICATION = 'awaiting_verification';
    public const STATUS_PAID = 'paid';
    public const STATUS_VOID = 'void';

    public const STATUSES = [
        self::STATUS_SCHEDULED, self::STATUS_DUE, self::STATUS_AWAITING_VERIFICATION, self::STATUS_PAID, self::STATUS_VOID,
    ];

    /** Belum lunas dan masih berlaku (dihitung sebagai sisa tagihan). */
    public const OPEN_STATUSES = [self::STATUS_SCHEDULED, self::STATUS_DUE, self::STATUS_AWAITING_VERIFICATION];

    public const TRIGGERS = InstallmentSchedule::TRIGGERS;

    protected $guarded = [];

    protected $translatable = ['label'];

    protected $casts = [
        'seq' => 'integer',
        'due_days' => 'integer',
        'reminder_count' => 'integer',
        'due_at' => 'datetime',
        'billed_at' => 'datetime',
        'paid_at' => 'datetime',
        'reminded_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'installment_id')->orderBy('id');
    }

    /** Termin pertama mengikuti alur order (pending_payment → payment_review → paid); termin berikutnya tidak mengubah status order. */
    public function isFirst(): bool
    {
        return (int) $this->seq === 1;
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }

    public function isDue(): bool
    {
        return $this->status === self::STATUS_DUE;
    }

    /** Sudah ditagih, belum dibayar, dan tanggal jatuh tempo lewat. */
    public function isOverdue(?Carbon $now = null): bool
    {
        return $this->isDue() && $this->due_at !== null && $this->due_at->lt($now ?? now());
    }

    public function currencyCode(): string
    {
        return Money::normalizeCurrency($this->currency);
    }

    public function amountInt(): int
    {
        return Money::toMinor($this->amount, $this->currencyCode()) ?? 0;
    }

    /** @return int|float 30 atau 33.33 */
    public function percentNumber()
    {
        return InstallmentSchedule::percentNumber(InstallmentSchedule::hundredths($this->percent));
    }

    /** Label satu bahasa untuk email/notifikasi. */
    public function labelText(?string $locale = null): string
    {
        return $this->tr('label', $locale);
    }

    /** Ringkas untuk baris payment dan notifikasi: { id, seq, key, label, percent, status }. */
    public function toBrief(): array
    {
        return [
            'id' => $this->id,
            'seq' => (int) $this->seq,
            'key' => $this->key,
            'label' => $this->label,
            'percent' => $this->percentNumber(),
            'status' => $this->status,
        ];
    }
}
