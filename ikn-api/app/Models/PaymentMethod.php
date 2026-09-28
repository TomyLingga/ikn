<?php

namespace App\Models;

use App\Support\HasTranslations;

// Metode pembayaran (KEPUTUSAN pembayaran). config hanya memuat nilai non-rahasia; kredensial gateway di .env.
class PaymentMethod extends Model
{
    use HasTranslations;

    public const TYPE_MANUAL_TRANSFER = 'manual_transfer';
    public const TYPE_QRIS_STATIC = 'qris_static';
    public const TYPE_QRIS_DYNAMIC = 'qris_dynamic';
    public const TYPE_VIRTUAL_ACCOUNT = 'virtual_account';
    public const TYPE_EWALLET = 'ewallet';
    public const TYPES = [
        self::TYPE_MANUAL_TRANSFER, self::TYPE_QRIS_STATIC, self::TYPE_QRIS_DYNAMIC,
        self::TYPE_VIRTUAL_ACCOUNT, self::TYPE_EWALLET,
    ];

    public const DRIVER_MANUAL = 'manual';
    public const DRIVER_XENDIT = 'xendit';
    public const DRIVERS = [self::DRIVER_MANUAL, self::DRIVER_XENDIT];

    /** Kunci config yang boleh disimpan (whitelist; rahasia gateway tidak pernah masuk DB). */
    public const CONFIG_KEYS = ['qrisMediaId', 'channelCode', 'bankCode', 'feePercent', 'feeFixed'];

    protected $fillable = ['code', 'type', 'driver', 'name', 'instructions', 'config', 'is_active', 'sort_order'];

    protected $translatable = ['name', 'instructions'];

    protected $casts = ['config' => 'array', 'is_active' => 'boolean', 'sort_order' => 'integer'];

    public function setCodeAttribute(?string $value): void
    {
        $this->attributes['code'] = strtolower(trim((string) $value));
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function isManual(): bool
    {
        return $this->driver === self::DRIVER_MANUAL;
    }

    public function isManualTransfer(): bool
    {
        return $this->type === self::TYPE_MANUAL_TRANSFER;
    }

    public function qrisMediaId(): ?int
    {
        $id = $this->config['qrisMediaId'] ?? null;

        return $id ? (int) $id : null;
    }

    public function qrisMedia(): ?Media
    {
        $id = $this->qrisMediaId();

        return $id ? Media::find($id) : null;
    }

    /** URL gambar QRIS statis (terhidrasi dari config.qrisMediaId) atau null. */
    public function qrisImageUrl(): ?string
    {
        $media = $this->qrisMedia();

        return $media ? $media->url() : null;
    }

    /** Bentuk publik (kontrak bagian 10): tanpa config. */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'type' => $this->type,
            'driver' => $this->driver,
            'name' => $this->name,
            'instructions' => $this->instructions,
            'qrisImageUrl' => $this->type === self::TYPE_QRIS_STATIC ? $this->qrisImageUrl() : null,
            'sortOrder' => $this->sort_order,
        ];
    }
}
