<?php

namespace App\Models;

use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Order (arsitektur bagian 6, state machine 7.1). Status hanya diubah lewat App\Services\Commerce\OrderStateMachine;
 * angka uang decimal(15,2) di DB dan integer rupiah di JSON (helper *Int()).
 */
class Order extends Model
{
    public const STATUS_PENDING_PAYMENT = 'pending_payment';
    public const STATUS_PAYMENT_REVIEW = 'payment_review';
    public const STATUS_PAID = 'paid';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_SHIPPED = 'shipped';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_EXPIRED = 'expired';

    public const STATUSES = [
        self::STATUS_PENDING_PAYMENT, self::STATUS_PAYMENT_REVIEW, self::STATUS_PAID, self::STATUS_PROCESSING,
        self::STATUS_SHIPPED, self::STATUS_DELIVERED, self::STATUS_COMPLETED, self::STATUS_CANCELLED, self::STATUS_EXPIRED,
    ];

    /** Status yang boleh diminta admin lewat POST /admin/orders/{n}/status. */
    public const ADMIN_TARGET_STATUSES = [self::STATUS_PROCESSING, self::STATUS_SHIPPED, self::STATUS_DELIVERED, self::STATUS_COMPLETED];

    /** Status "sudah dibayar" (dihitung sebagai pendapatan, ASUMSI A-24). */
    public const PAID_STATUSES = [self::STATUS_PAID, self::STATUS_PROCESSING, self::STATUS_SHIPPED, self::STATUS_DELIVERED, self::STATUS_COMPLETED];

    /** Status yang masih menunggu pembayaran/verifikasi (bisa diperpanjang batas waktunya). */
    public const AWAITING_PAYMENT_STATUSES = [self::STATUS_PENDING_PAYMENT, self::STATUS_PAYMENT_REVIEW];

    /** Status akhir (tidak ada transisi lagi). */
    public const FINAL_STATUSES = [self::STATUS_COMPLETED, self::STATUS_CANCELLED, self::STATUS_EXPIRED];

    /** Status yang sedang berjalan setelah dibayar (dashboard customer). */
    public const IN_PROGRESS_STATUSES = [self::STATUS_PAID, self::STATUS_PROCESSING, self::STATUS_SHIPPED, self::STATUS_DELIVERED];

    /** Kelompok status untuk tab "Pesanan saya" (GET /customer/orders?group=). `to_review` ditangani scopeAwaitingReview. */
    public const GROUPS = [
        'unpaid' => self::AWAITING_PAYMENT_STATUSES,
        'processing' => [self::STATUS_PAID, self::STATUS_PROCESSING],
        'shipped' => [self::STATUS_SHIPPED, self::STATUS_DELIVERED],
        'completed' => [self::STATUS_COMPLETED],
        'cancelled' => [self::STATUS_CANCELLED, self::STATUS_EXPIRED],
    ];

    public const GROUP_TO_REVIEW = 'to_review';

    protected $guarded = [];

    protected $casts = [
        'customer_snapshot' => 'array',
        'shipping_address_snapshot' => 'array',
        'shipping_snapshot' => 'array',
        'fees_snapshot' => 'array',
        'unique_code' => 'integer',
        'price_includes_tax' => 'boolean',
        'payment_due_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
        'paid_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'expired_at' => 'datetime',
    ];

    // ---- Relasi ----

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class)->orderBy('id');
    }

    public function histories()
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('created_at')->orderBy('id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class)->orderBy('id');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function voucherUsage()
    {
        return $this->hasOne(VoucherUsage::class);
    }

    /** Catatan perjalanan kiriman dari admin selama status shipped (ASUMSI A-70). */
    public function trackingUpdates()
    {
        return $this->hasMany(OrderTrackingUpdate::class)->orderBy('created_at')->orderBy('id');
    }

    /** Lampiran dari admin (faktur pajak, surat jalan; ASUMSI A-74). */
    public function attachments()
    {
        return $this->hasMany(OrderAttachment::class)->orderBy('created_at')->orderBy('id');
    }

    // ---- Scope ----

    public function scopeOwnedBy(Builder $query, User $user): Builder
    {
        return $query->where('user_id', $user->id);
    }

    public function scopeRevenue(Builder $query): Builder
    {
        return $query->whereNotNull('paid_at')->whereIn('status', self::PAID_STATUSES);
    }

    /** Order selesai yang masih punya produk belum diulas (ASUMSI A-13: satu ulasan per produk per order). */
    public function scopeAwaitingReview(Builder $query): Builder
    {
        return $query->where('orders.status', self::STATUS_COMPLETED)
            ->whereExists(function ($items) {
                $items->selectRaw('1')->from('order_items')
                    ->whereColumn('order_items.order_id', 'orders.id')
                    ->whereNotExists(function ($reviews) {
                        $reviews->selectRaw('1')->from('reviews')
                            ->whereColumn('reviews.order_id', 'orders.id')
                            ->whereColumn('reviews.product_id', 'order_items.product_id');
                    });
            });
    }

    /** Filter kelompok status (lihat GROUPS); nilai tak dikenal diabaikan. */
    public function scopeInGroup(Builder $query, ?string $group): Builder
    {
        if ($group === self::GROUP_TO_REVIEW) {
            return $query->awaitingReview();
        }

        return isset(self::GROUPS[$group]) ? $query->whereIn('orders.status', self::GROUPS[$group]) : $query;
    }

    // ---- Payment helpers ----

    /** Payment yang masih aktif (pending / awaiting_verification), terbaru dulu. */
    public function activePayment(): ?Payment
    {
        $payments = $this->relationLoaded('payments') ? $this->payments : $this->payments()->get();

        return $payments->whereIn('status', Payment::ACTIVE_STATUSES)->sortByDesc('id')->first();
    }

    public function latestPayment(): ?Payment
    {
        $payments = $this->relationLoaded('payments') ? $this->payments : $this->payments()->get();

        return $payments->sortByDesc('id')->first();
    }

    /** Invarian arsitektur 7.1: payment_status selalu = status payment terbaru (tanpa menyimpan). */
    public function syncPaymentStatus(): void
    {
        // Query langsung (bukan relasi payments() yang sudah orderBy id ASC) agar benar-benar payment terbaru.
        $latest = Payment::where('order_id', $this->id)->orderByDesc('id')->first();
        $this->payment_status = $latest?->status;
        if ($this->relationLoaded('payments')) {
            $this->unsetRelation('payments');
        }
    }

    // ---- Status helpers ----

    public function isAwaitingPayment(): bool
    {
        return in_array($this->status, self::AWAITING_PAYMENT_STATUSES, true);
    }

    public function isPaymentDuePassed(?Carbon $now = null): bool
    {
        return $this->payment_due_at !== null && $this->payment_due_at->lt($now ?? now());
    }

    public function canCancel(): bool
    {
        return $this->status === self::STATUS_PENDING_PAYMENT;
    }

    /** Customer boleh unggah bukti: pending_payment, belum lewat batas waktu, metode manual. */
    public function canUploadProof(): bool
    {
        if ($this->status !== self::STATUS_PENDING_PAYMENT || $this->isPaymentDuePassed()) {
            return false;
        }
        $latest = $this->latestPayment();

        return $latest === null || $latest->provider === PaymentMethod::DRIVER_MANUAL;
    }

    public function canChangePayment(): bool
    {
        return $this->status === self::STATUS_PENDING_PAYMENT && ! $this->isPaymentDuePassed();
    }

    public function canConfirmReceived(): bool
    {
        return $this->status === self::STATUS_SHIPPED;
    }

    public function canComplete(): bool
    {
        return $this->status === self::STATUS_DELIVERED;
    }

    /** Admin boleh menambah/menghapus catatan perjalanan hanya selama kiriman di jalan. */
    public function canAddTracking(): bool
    {
        return $this->status === self::STATUS_SHIPPED;
    }

    /** Ulasan hanya order completed, satu per produk per order (ASUMSI A-13). */
    public function canReview(): bool
    {
        if ($this->status !== self::STATUS_COMPLETED) {
            return false;
        }

        return $this->unreviewedProductIds() !== [];
    }

    /** @return int[] */
    public function reviewedProductIds(): array
    {
        $reviews = $this->relationLoaded('reviews') ? $this->reviews : $this->reviews()->get();

        return $reviews->pluck('product_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
    }

    /** @return int[] */
    public function unreviewedProductIds(): array
    {
        $items = $this->relationLoaded('items') ? $this->items : $this->items()->get();
        $reviewed = $this->reviewedProductIds();

        return $items->pluck('product_id')->map(fn ($id) => (int) $id)->unique()
            ->reject(fn ($id) => in_array($id, $reviewed, true))->values()->all();
    }

    // ---- Snapshot helpers ----

    public function customerName(): string
    {
        return (string) ($this->customer_snapshot['name'] ?? $this->customer_snapshot['pic'] ?? '');
    }

    public function customerEmail(): string
    {
        return (string) ($this->customer_snapshot['email'] ?? '');
    }

    public function customerCompany(): ?string
    {
        return $this->customer_snapshot['company'] ?? null;
    }

    public function customerPic(): ?string
    {
        return $this->customer_snapshot['pic'] ?? null;
    }

    public function preferredLocale(): string
    {
        return in_array($this->locale, User::LOCALES, true) ? $this->locale : 'id';
    }

    // ---- Uang (integer rupiah) ----

    public function subtotalInt(): int
    {
        return Money::toInt($this->subtotal);
    }

    public function discountTotalInt(): int
    {
        return Money::toInt($this->discount_total);
    }

    public function shippingTotalInt(): int
    {
        return Money::toInt($this->shipping_total);
    }

    public function feeTotalInt(): int
    {
        return Money::toInt($this->fee_total);
    }

    public function taxTotalInt(): int
    {
        return Money::toInt($this->tax_total);
    }

    public function grandTotalInt(): int
    {
        return Money::toInt($this->grand_total);
    }

    /** Total tanpa kode unik (dasar bila kode unik dihitung ulang saat ganti metode bayar). */
    public function grandTotalBeforeUniqueCode(): int
    {
        return $this->grandTotalInt() - (int) $this->unique_code;
    }

    /** @return int|float persen pajak (11 → 11, 11.5 → 11.5) */
    public function taxRateNumber()
    {
        $rate = (float) $this->tax_rate;

        return floor($rate) == $rate ? (int) $rate : $rate;
    }
}
