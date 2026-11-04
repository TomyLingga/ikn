<?php

namespace App\Models;

use Illuminate\Support\Carbon;

/**
 * Penawaran ongkir CIF per putaran (ASUMSI A-89). Admin menawar dengan rincian baris (ongkos kapal, biaya pelabuhan,
 * asuransi, lainnya); customer menerima atau membalas dengan satu angka; admin boleh menerima balasan itu atau menawar
 * lagi. `lines[].amount` dan totalMinor() dalam satuan terkecil mata uang order (USD sen); kolom `total` decimal satuan
 * mayor. Semua perubahan hanya lewat App\Services\Commerce\FreightQuoteService.
 */
class OrderFreightQuote extends Model
{
    public const STATUS_PROPOSED = 'proposed';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_SUPERSEDED = 'superseded';
    public const STATUS_EXPIRED = 'expired';
    public const STATUSES = [self::STATUS_PROPOSED, self::STATUS_ACCEPTED, self::STATUS_REJECTED, self::STATUS_SUPERSEDED, self::STATUS_EXPIRED];

    public const BY_ADMIN = 'admin';
    public const BY_CUSTOMER = 'customer';
    public const PROPOSERS = [self::BY_ADMIN, self::BY_CUSTOMER];

    protected $guarded = [];

    protected $casts = [
        'round' => 'integer',
        'lines' => 'array',
        'valid_until' => 'datetime',
        'responded_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    /** Total dari rincian baris (integer satuan terkecil); kolom `total` hanya salinan decimal untuk laporan. */
    public function totalMinor(): int
    {
        return (int) array_sum(array_map(fn ($line) => (int) ($line['amount'] ?? 0), is_array($this->lines) ? $this->lines : []));
    }

    public function isProposed(): bool
    {
        return $this->status === self::STATUS_PROPOSED;
    }

    public function isByAdmin(): bool
    {
        return $this->proposed_by === self::BY_ADMIN;
    }

    /** Lewat masa berlaku (status sudah expired, atau masih proposed tetapi valid_until sudah lewat sebelum scheduler jalan). */
    public function isExpired(?Carbon $now = null): bool
    {
        if ($this->status === self::STATUS_EXPIRED) {
            return true;
        }

        // Penawaran yang sudah ditutup (accepted/superseded/rejected) tidak pernah dianggap kedaluwarsa.
        return $this->isProposed() && $this->valid_until !== null && $this->valid_until->lt($now ?? now());
    }

    /** Masih bisa diterima pihak lawan: proposed dan belum kedaluwarsa. */
    public function isOpen(?Carbon $now = null): bool
    {
        return $this->isProposed() && ! $this->isExpired($now);
    }

    /** @return array<int, array{label:string, amount:int}> */
    public function normalizedLines(): array
    {
        $out = [];
        foreach (is_array($this->lines) ? $this->lines : [] as $line) {
            $out[] = ['label' => (string) ($line['label'] ?? ''), 'amount' => (int) ($line['amount'] ?? 0)];
        }

        return $out;
    }

    public function toSummary(): array
    {
        $creator = $this->relationLoaded('creator') ? $this->creator : null;

        return [
            'id' => $this->id,
            'round' => (int) $this->round,
            'proposedBy' => $this->proposed_by,
            'lines' => $this->normalizedLines(),
            'total' => $this->totalMinor(),
            'note' => $this->note,
            'validUntil' => optional($this->valid_until)->toApiString(),
            'status' => $this->status,
            'expired' => $this->isExpired(),
            'createdBy' => $creator ? ['id' => $creator->id, 'name' => $creator->name] : null,
            'createdAt' => optional($this->created_at)->toApiString(),
            'respondedAt' => optional($this->responded_at)->toApiString(),
        ];
    }
}
