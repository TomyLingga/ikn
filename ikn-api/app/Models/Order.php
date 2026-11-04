<?php

namespace App\Models;

use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Order (arsitektur bagian 6, state machine 7.1). Status hanya diubah lewat App\Services\Commerce\OrderStateMachine;
 * angka uang decimal(15,2) di DB (satuan mayor) dan integer satuan terkecil mata uang order di JSON (helper *Int(),
 * ASUMSI A-86: IDR rupiah bulat, USD sen).
 */
class Order extends Model
{
    /** CIF (ASUMSI A-89): menunggu penawaran ongkir admin disetujui sebelum pembayaran dibuat. */
    public const STATUS_AWAITING_FREIGHT = 'awaiting_freight';
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
        self::STATUS_AWAITING_FREIGHT, self::STATUS_PENDING_PAYMENT, self::STATUS_PAYMENT_REVIEW, self::STATUS_PAID, self::STATUS_PROCESSING,
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

    /** Status yang bisa dibatalkan customer sendiri (menunggu penawaran ongkir atau menunggu pembayaran). */
    public const CUSTOMER_CANCELLABLE_STATUSES = [self::STATUS_AWAITING_FREIGHT, self::STATUS_PENDING_PAYMENT];

    /** Kelompok status untuk tab "Pesanan saya" (GET /customer/orders?group=). `to_review` ditangani scopeAwaitingReview. */
    public const GROUPS = [
        'unpaid' => [self::STATUS_AWAITING_FREIGHT, self::STATUS_PENDING_PAYMENT, self::STATUS_PAYMENT_REVIEW],
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
        'payment_term_snapshot' => 'array',
        'shipment_details' => 'array',
        'destination_port' => 'array',
        'pending_payment_method' => 'array',
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

    /** Data proforma invoice yang bisa diedit admin (ASUMSI A-88); satu per order, null sebelum pertama kali disimpan. */
    public function proforma()
    {
        return $this->hasOne(OrderProforma::class);
    }

    /** Penawaran ongkir CIF per putaran, terbaru dulu (ASUMSI A-89). */
    public function freightQuotes()
    {
        return $this->hasMany(OrderFreightQuote::class)->orderByDesc('round')->orderByDesc('id');
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

    /** Hanya order bermata uang tertentu; agregasi uang tidak boleh mencampur IDR dan USD (ASUMSI A-86). */
    public function scopeInCurrency(Builder $query, string $currency): Builder
    {
        return $query->where('orders.currency', Money::normalizeCurrency($currency));
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
        return in_array($this->status, self::CUSTOMER_CANCELLABLE_STATUSES, true);
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

    /** Admin boleh menambah/menghapus catatan perjalanan hanya selama kiriman di jalan (tidak untuk Loco). */
    public function canAddTracking(): bool
    {
        return $this->status === self::STATUS_SHIPPED && ! $this->isPickup();
    }

    // ---- Cara serah terima (ASUMSI A-85) ----

    /** Loco: diambil customer di pabrik; shipped/delivered berarti "siap diambil"/"sudah diambil", tanpa kurir dan resi. */
    public function isPickup(): bool
    {
        return ($this->shipping_snapshot['type'] ?? null) === 'pickup';
    }

    /** Titik ambil (pertama) yang dibekukan saat checkout: { label, address, lat, lng } atau null bila bukan Loco. */
    public function pickupPoint(): ?array
    {
        $snapshot = $this->shipping_address_snapshot;
        if (! $this->isPickup() || ! is_array($snapshot)) {
            return null;
        }

        return [
            'label' => $snapshot['label'] ?? null,
            'address' => $snapshot['address'] ?? null,
            'lat' => $snapshot['lat'] ?? null,
            'lng' => $snapshot['lng'] ?? null,
        ];
    }

    /**
     * Semua titik ambil (ASUMSI A-90): satu per pabrik asal item, { code, name, label, address, lat, lng, items[] }.
     * Snapshot sebelum A-90 tanpa `points` = satu titik dari field datar (code/name null, items kosong). [] bila bukan Loco.
     */
    public function pickupPoints(): array
    {
        $snapshot = $this->shipping_address_snapshot;
        if (! $this->isPickup() || ! is_array($snapshot)) {
            return [];
        }
        $points = isset($snapshot['points']) && is_array($snapshot['points']) && $snapshot['points'] !== []
            ? $snapshot['points']
            : [['code' => null, 'name' => null] + $this->pickupPoint() + ['items' => []]];

        return array_values(array_map(fn ($point) => [
            'code' => $point['code'] ?? null,
            'name' => $point['name'] ?? null,
            'label' => $point['label'] ?? null,
            'address' => $point['address'] ?? null,
            'lat' => $point['lat'] ?? null,
            'lng' => $point['lng'] ?? null,
            'items' => array_values($point['items'] ?? []),
        ], $points));
    }

    /**
     * Label titik ambil untuk kalimat histori/notifikasi: nama pabrik dalam bahasa yang diminta, lebih dari satu titik
     * digabung ("A dan B", "A, B dan C"); label kosong diganti "pabrik" agar kalimat tetap utuh.
     */
    public function pickupLabel(?string $locale = null): string
    {
        $locale = $locale ?? $this->preferredLocale();
        $labels = [];
        foreach ($this->pickupPoints() as $point) {
            $name = is_array($point['name'] ?? null) ? trim((string) ($point['name'][$locale] ?? '')) : '';
            $label = $name !== '' ? $name : trim((string) ($point['label'] ?? ''));
            if ($label !== '' && ! in_array($label, $labels, true)) {
                $labels[] = $label;
            }
        }
        if ($labels === []) {
            return (string) __('commerce.pickup_default_label', [], $locale);
        }
        if (count($labels) === 1) {
            return $labels[0];
        }
        $last = array_pop($labels);

        return (string) __('commerce.pickup_label_join', ['list' => implode(', ', $labels), 'last' => $last], $locale);
    }

    // ---- Term pelabuhan: FOB/CIF (ASUMSI A-86, A-88) ----

    /** FOB/CIF: serah terima di pelabuhan; shipped = dimuat ke kapal (nama kapal + B/L), bukan kurir + resi. */
    public function isPort(): bool
    {
        return ($this->shipping_snapshot['family'] ?? null) === DeliveryTerm::FAMILY_PORT
            || ($this->shipping_address_snapshot['type'] ?? null) === 'port';
    }

    /** Data kapal/B/L yang dicatat saat shipped on board: { vessel, voyage, blNumber, blDate } atau null. */
    public function shipmentDetails(): ?array
    {
        $details = $this->shipment_details;
        if (! is_array($details) || $details === []) {
            return null;
        }

        return [
            'vessel' => $details['vessel'] ?? null,
            'voyage' => $details['voyage'] ?? null,
            'blNumber' => $details['blNumber'] ?? null,
            'blDate' => $details['blDate'] ?? null,
        ];
    }

    // ---- Penawaran ongkir CIF (ASUMSI A-89) ----

    public function isAwaitingFreight(): bool
    {
        return $this->status === self::STATUS_AWAITING_FREIGHT;
    }

    /** Term ber-pricing_mode quoted (CIF): ongkir ditetapkan lewat penawaran admin, bukan tarif zona. */
    public function isQuotedFreight(): bool
    {
        return ($this->shipping_snapshot['pricingMode'] ?? null) === DeliveryTerm::PRICING_QUOTED
            || ($this->shipping_snapshot['type'] ?? null) === 'quoted';
    }

    /** Pelabuhan tujuan yang dipilih saat checkout: { name, country, countryCode, lat, lng } atau null. */
    public function destinationPort(): ?array
    {
        $port = $this->destination_port;
        if (! is_array($port) || trim((string) ($port['name'] ?? '')) === '') {
            return null;
        }

        return [
            'name' => (string) $port['name'],
            'country' => $port['country'] ?? null,
            'countryCode' => $port['countryCode'] ?? null,
            'lat' => isset($port['lat']) ? (float) $port['lat'] : null,
            'lng' => isset($port['lng']) ? (float) $port['lng'] : null,
        ];
    }

    /** Putaran penawaran terakhir (round terbesar) atau null. */
    public function latestFreightQuote(): ?OrderFreightQuote
    {
        $quotes = $this->relationLoaded('freightQuotes') ? $this->freightQuotes : $this->freightQuotes()->get();

        return $quotes->sortByDesc(fn (OrderFreightQuote $q) => [$q->round, $q->id])->first();
    }

    /** Penawaran yang masih berstatus proposed (putaran terakhir), termasuk yang sudah lewat masa berlaku tetapi belum ditandai scheduler. */
    public function activeFreightQuote(): ?OrderFreightQuote
    {
        $latest = $this->latestFreightQuote();

        return $latest && $latest->isProposed() ? $latest : null;
    }

    /** Customer boleh menerima atau membalas: order menunggu ongkir dan penawaran admin terakhir masih berlaku. */
    public function canAcceptFreightQuote(): bool
    {
        $quote = $this->activeFreightQuote();

        return $this->isAwaitingFreight() && $quote !== null && $quote->isByAdmin() && $quote->isOpen();
    }

    public function canCounterFreightQuote(): bool
    {
        return $this->canAcceptFreightQuote();
    }

    /** Admin boleh membuat penawaran baru (atau menerima balasan customer) selama order menunggu ongkir. */
    public function canQuoteFreight(): bool
    {
        return $this->isAwaitingFreight();
    }

    /** Proforma boleh dibuat/diubah selama order tidak dibatalkan atau kedaluwarsa (FE memutuskan kapan menampilkannya). */
    public function canEditProforma(): bool
    {
        return ! in_array($this->status, [self::STATUS_CANCELLED, self::STATUS_EXPIRED], true);
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

    // ---- Uang (integer satuan terkecil mata uang order) ----

    /** Mata uang order (IDR bila kolom kosong, order sebelum E3). */
    public function currencyCode(): string
    {
        return Money::normalizeCurrency($this->currency);
    }

    public function isUsd(): bool
    {
        return $this->currencyCode() === Money::CURRENCY_USD;
    }

    private function minor($value): int
    {
        return Money::toMinor($value, $this->currencyCode()) ?? 0;
    }

    public function subtotalInt(): int
    {
        return $this->minor($this->subtotal);
    }

    public function discountTotalInt(): int
    {
        return $this->minor($this->discount_total);
    }

    public function shippingTotalInt(): int
    {
        return $this->minor($this->shipping_total);
    }

    public function feeTotalInt(): int
    {
        return $this->minor($this->fee_total);
    }

    public function taxTotalInt(): int
    {
        return $this->minor($this->tax_total);
    }

    public function grandTotalInt(): int
    {
        return $this->minor($this->grand_total);
    }

    /** Syarat pembayaran yang dibekukan saat checkout (ASUMSI A-87) atau null untuk order lokal. */
    public function paymentTerm(): ?array
    {
        $snapshot = $this->payment_term_snapshot;
        if (! is_array($snapshot) && ! $this->payment_term_code) {
            return null;
        }

        return [
            'code' => $this->payment_term_code ?: ($snapshot['code'] ?? null),
            'name' => $snapshot['name'] ?? null,
            'description' => $snapshot['description'] ?? null,
        ];
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
