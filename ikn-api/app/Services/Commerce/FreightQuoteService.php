<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Models\OrderStatusHistory;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Payment\PaymentService;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Satu pintu penawaran ongkir CIF (ASUMSI A-89). Setiap aksi berjalan dalam transaksi dengan baris order dikunci
 * FOR UPDATE agar dua accept bersamaan (customer vs admin, atau dua tab) hanya satu yang berhasil. Admin menawar
 * dengan rincian baris, customer menerima atau membalas dengan satu angka, admin menerima balasan atau menawar lagi.
 * Saat penawaran diterima: shipping_total + grand_total dihitung ulang (OrderCalculator::grandTotalOf), payment dibuat
 * dari pending_payment_method, payment_due_at ditetapkan, lalu awaiting_freight → pending_payment lewat OrderStateMachine.
 */
class FreightQuoteService
{
    public function __construct(
        private CommerceSettings $settings,
        private PaymentService $payments,
        private OrderStateMachine $stateMachine,
        private OrderNotifier $notifier,
        private AuditLogger $audit,
        private UniqueCodeAllocator $uniqueCodes,
    ) {
    }

    /**
     * Admin mengirim penawaran baru; penawaran terbuka sebelumnya menjadi superseded.
     *
     * @param  array<int, array{label:string, amount:int}>  $lines  amount = satuan terkecil mata uang order
     *
     * @throws ApiException 409 FREIGHT_QUOTE_NOT_ALLOWED bila order tidak awaiting_freight
     * @throws ValidationException 422 validUntil di masa lalu / total 0
     */
    public function adminPropose(Order $order, User $admin, array $lines, ?Carbon $validUntil = null, ?string $note = null): OrderFreightQuote
    {
        $lines = $this->normalizeLines($lines);
        if (array_sum(array_column($lines, 'amount')) <= 0) {
            throw ValidationException::withMessages(['lines' => [__('commerce.freight_quote_total_required')]]);
        }

        $quote = DB::transaction(function () use ($order, $admin, $lines, $validUntil, $note) {
            $locked = $this->lock($order);
            $this->assertAwaitingFreight($locked);
            $now = now();
            $validUntil = $validUntil ? $this->assertFuture($validUntil, $now) : $now->copy()->addDays((int) $this->settings->get('freight_quote_valid_days'));

            OrderFreightQuote::where('order_id', $locked->id)->where('status', OrderFreightQuote::STATUS_PROPOSED)->update([
                'status' => OrderFreightQuote::STATUS_SUPERSEDED,
                'responded_at' => $this->dbTime($now),
                'updated_at' => $this->dbTime($now),
            ]);

            return OrderFreightQuote::create([
                'order_id' => $locked->id,
                'round' => (int) OrderFreightQuote::where('order_id', $locked->id)->max('round') + 1,
                'proposed_by' => OrderFreightQuote::BY_ADMIN,
                'lines' => $lines,
                'total' => Money::fromMinor(array_sum(array_column($lines, 'amount')), $locked->currencyCode()),
                'note' => $this->cleanNote($note),
                'valid_until' => $validUntil,
                'status' => OrderFreightQuote::STATUS_PROPOSED,
                'created_by' => $admin->id,
            ]);
        });

        $order->refresh();
        $this->notifier->freightQuoted($order, $quote->load('creator'));

        return $quote;
    }

    /**
     * Admin memperpanjang masa berlaku penawarannya yang masih proposed, atau menghidupkan kembali yang expired.
     *
     * @throws ApiException 404 bila bukan penawaran order ini; 409 FREIGHT_QUOTE_STALE bila bukan putaran terakhir/bukan penawaran admin/sudah ditutup
     * @throws ValidationException 422 validUntil di masa lalu
     */
    public function adminExtend(Order $order, OrderFreightQuote $quote, Carbon $validUntil, User $admin): OrderFreightQuote
    {
        $quote = DB::transaction(function () use ($order, $quote, $validUntil) {
            $locked = $this->lock($order);
            $this->assertAwaitingFreight($locked);
            $fresh = $this->lockQuote($locked, $quote);
            $now = now();

            if (! $fresh->isByAdmin() || ! in_array($fresh->status, [OrderFreightQuote::STATUS_PROPOSED, OrderFreightQuote::STATUS_EXPIRED], true) || ! $this->isLatest($locked, $fresh)) {
                throw $this->stale($fresh);
            }
            $fresh->forceFill([
                'valid_until' => $this->assertFuture($validUntil, $now),
                'status' => OrderFreightQuote::STATUS_PROPOSED,
                'responded_at' => null,
            ])->save();

            return $fresh;
        });

        $order->refresh();
        $this->notifier->freightQuoted($order, $quote->load('creator'), true);

        return $quote;
    }

    /**
     * Customer membalas penawaran admin yang masih berlaku dengan satu angka; penawaran admin menjadi superseded.
     *
     * @throws ApiException 409 FREIGHT_QUOTE_NOT_ALLOWED (tidak ada penawaran admin terbuka) | FREIGHT_QUOTE_EXPIRED
     */
    public function customerCounter(Order $order, User $user, int $amount, ?string $note = null): OrderFreightQuote
    {
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => [__('commerce.freight_quote_total_required')]]);
        }

        $result = DB::transaction(function () use ($order, $user, $amount, $note) {
            $locked = $this->lock($order);
            $this->assertAwaitingFreight($locked);
            $latest = $this->latestLocked($locked);
            $now = now();

            if ($latest && $latest->isByAdmin() && $this->expiredOrOverdue($latest, $now)) {
                return ['expired' => $latest]; // ditandai di luar transaksi ini (lihat failExpired)
            }
            if (! $latest || ! $latest->isByAdmin() || ! $latest->isProposed()) {
                throw ApiException::conflict('FREIGHT_QUOTE_NOT_ALLOWED', __('commerce.freight_counter_not_allowed'), ['status' => $locked->status, 'quoteId' => $latest?->id]);
            }

            $latest->forceFill(['status' => OrderFreightQuote::STATUS_SUPERSEDED, 'responded_at' => $now])->save();

            return ['quote' => OrderFreightQuote::create([
                'order_id' => $locked->id,
                'round' => $latest->round + 1,
                'proposed_by' => OrderFreightQuote::BY_CUSTOMER,
                'lines' => [['label' => __('commerce.freight_counter_label', [], 'id'), 'amount' => $amount]],
                'total' => Money::fromMinor($amount, $locked->currencyCode()),
                'note' => $this->cleanNote($note),
                'valid_until' => null,
                'status' => OrderFreightQuote::STATUS_PROPOSED,
                'created_by' => $user->id,
            ])];
        });
        if (isset($result['expired'])) {
            $this->failExpired($order, $result['expired']);
        }
        $quote = $result['quote'];

        $order->refresh();
        $this->notifier->freightCountered($order, $quote->load('creator'));

        return $quote;
    }

    /** Customer menerima penawaran admin terakhir yang masih berlaku → order pending_payment dengan payment dan batas bayar. */
    public function customerAccept(Order $order, User $user, OrderFreightQuote $quote): Order
    {
        return $this->accept($order, $quote, $user, OrderFreightQuote::BY_CUSTOMER);
    }

    /** Admin menerima harga balasan customer → efek sama dengan customer menerima penawaran. */
    public function adminAcceptCounter(Order $order, OrderFreightQuote $quote, User $admin): Order
    {
        return $this->accept($order, $quote, $admin, OrderFreightQuote::BY_ADMIN);
    }

    /**
     * @param  string  $acceptedBy  customer (menerima penawaran admin) | admin (menerima balasan customer)
     *
     * @throws ApiException 409 FREIGHT_QUOTE_STALE (bukan putaran terakhir / sudah ditutup) | FREIGHT_QUOTE_EXPIRED | FREIGHT_QUOTE_NOT_ALLOWED | INVALID_TRANSITION
     */
    private function accept(Order $order, OrderFreightQuote $quote, User $actor, string $acceptedBy): Order
    {
        $result = DB::transaction(function () use ($order, $quote, $actor, $acceptedBy) {
            $locked = $this->lock($order);
            $fresh = $this->lockQuote($locked, $quote);
            $now = now();

            // Urutan galat: kedaluwarsa (bisa diperpanjang admin) → sudah ditutup/bukan putaran terakhir (stale) → status order → pihak.
            if ($this->expiredOrOverdue($fresh, $now)) {
                return ['expired' => $fresh]; // ditandai di luar transaksi ini (lihat failExpired)
            }
            if (! $fresh->isProposed()) {
                throw $this->stale($fresh);
            }
            $this->assertAwaitingFreight($locked);
            if (! $this->isLatest($locked, $fresh)) {
                throw $this->stale($fresh);
            }
            $expectedProposer = $acceptedBy === OrderFreightQuote::BY_CUSTOMER ? OrderFreightQuote::BY_ADMIN : OrderFreightQuote::BY_CUSTOMER;
            if ($fresh->proposed_by !== $expectedProposer) {
                throw ApiException::conflict('FREIGHT_QUOTE_NOT_ALLOWED', __('commerce.freight_accept_not_allowed'), ['quoteId' => $fresh->id, 'proposedBy' => $fresh->proposed_by]);
            }

            // Metode + rekening dulu: bila tidak ada lagi yang aktif, 409 sebelum apa pun ditulis (transaksi di-rollback).
            $currency = $locked->currencyCode();
            [$method, $bank] = $this->resolvePendingPayment($locked);

            $fresh->forceFill(['status' => OrderFreightQuote::STATUS_ACCEPTED, 'responded_at' => $now])->save();

            // Kode unik IDR (term quoted lokal) baru dialokasikan di sini; checkout tidak memberinya (ASUMSI A-9, A-89).
            $locked->unique_code = $this->uniqueCodes->requiredFor($method, $currency)
                ? $this->uniqueCodes->allocate($locked->user_id.'|'.$locked->number, $locked->id)
                : 0;

            // Ongkir final + hitung ulang grand total dengan aritmetika yang sama dengan quote/checkout.
            $total = $fresh->totalMinor();
            $locked->shipping_total = Money::fromMinor($total, $currency);
            $locked->shipping_snapshot = array_merge($locked->shipping_snapshot ?? [], [
                'type' => 'quoted',
                'amount' => $total,
                'quoteId' => $fresh->id,
                'round' => $fresh->round,
                'lines' => $fresh->normalizedLines(),
            ]);
            $locked->grand_total = Money::fromMinor(OrderCalculator::grandTotalOf(
                $locked->subtotalInt(),
                $locked->discountTotalInt(),
                $total,
                $locked->feeTotalInt(),
                $locked->taxTotalInt(),
                (bool) $locked->price_includes_tax,
                (int) $locked->unique_code
            ), $currency);
            $dueHours = (int) $this->settings->get($locked->isUsd() ? 'export_payment_due_hours' : 'payment_due_hours');
            $locked->payment_due_at = $now->copy()->addHours($dueHours);
            $locked->reminder_sent_at = null;
            $locked->save();

            $this->payments->create($locked, $method, $bank, $actor);

            $this->stateMachine->transition($locked, Order::STATUS_PENDING_PAYMENT, $actor, [
                'quoteId' => $fresh->id,
                'freightTotal' => $total,
                'acceptedBy' => $acceptedBy,
            ]);

            return ['ok' => true];
        });
        if (isset($result['expired'])) {
            $this->failExpired($order, $result['expired']);
        }

        return $order->refresh();
    }

    // ---- Scheduler (orders:freight-expire) ----

    /** Penawaran proposed yang lewat valid_until → expired (+ notifikasi customer in-app, email admin). Idempoten. */
    public function expireQuotes(?Carbon $now = null): int
    {
        $now = $now ?? now();
        $count = 0;
        $query = OrderFreightQuote::where('status', OrderFreightQuote::STATUS_PROPOSED)
            ->whereNotNull('valid_until')->where('valid_until', '<', $now)->orderBy('id');

        foreach ($query->cursor() as $quote) {
            $result = DB::transaction(function () use ($quote, $now) {
                $order = Order::whereKey($quote->order_id)->lockForUpdate()->first();
                $fresh = OrderFreightQuote::whereKey($quote->id)->lockForUpdate()->first();
                if (! $order || ! $fresh || ! $fresh->isProposed() || $fresh->valid_until === null || $fresh->valid_until->gte($now)) {
                    return null;
                }
                $this->markExpired($fresh, $now);

                return [$order, $fresh];
            });
            if ($result) {
                $this->notifier->freightQuoteExpired($result[0], $result[1]);
                $count++;
            }
        }

        return $count;
    }

    /**
     * Order awaiting_freight lebih lama dari batas tunggu tanpa penawaran proposed yang masih berlaku → cancelled (actor
     * system, stok dilepas, penawaran terbuka ditolak) lewat OrderStateMachine. Idempoten.
     */
    public function cancelStale(?Carbon $now = null, ?int $maxDays = null): int
    {
        $now = $now ?? now();
        $maxDays = $maxDays ?? (int) $this->settings->get('freight_quote_max_days');
        if ($maxDays <= 0) {
            return 0;
        }
        $count = 0;
        $query = Order::where('status', Order::STATUS_AWAITING_FREIGHT)
            ->where('created_at', '<', $now->copy()->subDays($maxDays))
            ->whereNotExists(function ($q) use ($now) {
                $q->selectRaw('1')->from('order_freight_quotes')
                    ->whereColumn('order_freight_quotes.order_id', 'orders.id')
                    ->where('order_freight_quotes.status', OrderFreightQuote::STATUS_PROPOSED)
                    ->where(fn ($w) => $w->whereNull('order_freight_quotes.valid_until')->orWhere('order_freight_quotes.valid_until', '>', $now));
            })
            ->orderBy('id');

        foreach ($query->cursor() as $order) {
            try {
                $this->stateMachine->transition($order, Order::STATUS_CANCELLED, null, [
                    'actorType' => OrderStatusHistory::ACTOR_SYSTEM,
                    'reason' => __('commerce.freight_max_wait_reason', [], $order->preferredLocale()),
                    'days' => $maxDays,
                ]);
                $count++;
            } catch (Throwable $e) {
                // Order yang berubah status di antara query dan transisi dilewati; putaran berikutnya mengulang.
                continue;
            }
        }

        return $count;
    }

    // ---- helper ----

    private function lock(Order $order): Order
    {
        $locked = Order::whereKey($order->id)->lockForUpdate()->first();
        if (! $locked) {
            throw ApiException::notFound();
        }

        return $locked;
    }

    private function lockQuote(Order $order, OrderFreightQuote $quote): OrderFreightQuote
    {
        $fresh = OrderFreightQuote::whereKey($quote->id)->lockForUpdate()->first();
        if (! $fresh || (int) $fresh->order_id !== (int) $order->id) {
            throw ApiException::notFound();
        }

        return $fresh;
    }

    private function latestLocked(Order $order): ?OrderFreightQuote
    {
        return OrderFreightQuote::where('order_id', $order->id)->orderByDesc('round')->orderByDesc('id')->lockForUpdate()->first();
    }

    private function isLatest(Order $order, OrderFreightQuote $quote): bool
    {
        $latest = $this->latestLocked($order);

        return $latest !== null && (int) $latest->id === (int) $quote->id;
    }

    private function assertAwaitingFreight(Order $order): void
    {
        if (! $order->isAwaitingFreight()) {
            throw ApiException::conflict('FREIGHT_QUOTE_NOT_ALLOWED', __('commerce.freight_quote_not_allowed'), ['status' => $order->status]);
        }
    }

    private function assertFuture(Carbon $validUntil, Carbon $now): Carbon
    {
        if ($validUntil->lte($now)) {
            throw ValidationException::withMessages(['validUntil' => [__('commerce.freight_valid_until_past')]]);
        }

        return $validUntil;
    }

    /** Sudah berstatus expired, atau masih proposed tetapi valid_until lewat (scheduler belum jalan). Tanpa menulis. */
    private function expiredOrOverdue(OrderFreightQuote $quote, Carbon $now): bool
    {
        return $quote->isExpired($now);
    }

    /**
     * Penawaran yang kedaluwarsa ditemukan saat aksi customer/admin sebelum scheduler: tandai expired dalam transaksi
     * tersendiri (aksi utamanya sudah di-rollback) dengan notifikasi yang sama seperti orders:freight-expire, lalu 409.
     *
     * @throws ApiException 409 FREIGHT_QUOTE_EXPIRED
     */
    private function failExpired(Order $order, OrderFreightQuote $quote): void
    {
        $now = now();
        $marked = DB::transaction(function () use ($quote, $now) {
            $fresh = OrderFreightQuote::whereKey($quote->id)->lockForUpdate()->first();
            if (! $fresh || ! $fresh->isProposed()) {
                return null;
            }
            $this->markExpired($fresh, $now);

            return $fresh;
        });
        if ($marked) {
            $this->notifier->freightQuoteExpired($order->refresh(), $marked);
        }

        throw $this->expired($quote->fresh() ?? $quote);
    }

    private function markExpired(OrderFreightQuote $quote, Carbon $now): void
    {
        $quote->forceFill(['status' => OrderFreightQuote::STATUS_EXPIRED])->save();
        $this->audit->log(null, 'freight_quote.expired [system]', $quote, ['status' => OrderFreightQuote::STATUS_PROPOSED], [
            'status' => OrderFreightQuote::STATUS_EXPIRED,
            'validUntil' => optional($quote->valid_until)->toApiString(),
            'orderId' => $quote->order_id,
        ]);
    }

    private function stale(OrderFreightQuote $quote): ApiException
    {
        return ApiException::conflict('FREIGHT_QUOTE_STALE', __('commerce.freight_quote_stale'), ['quoteId' => $quote->id, 'status' => $quote->status]);
    }

    private function expired(OrderFreightQuote $quote): ApiException
    {
        return ApiException::conflict('FREIGHT_QUOTE_EXPIRED', __('commerce.freight_quote_expired'), ['quoteId' => $quote->id, 'validUntil' => optional($quote->valid_until)->toApiString()]);
    }

    /**
     * Metode + rekening dari pending_payment_method yang dibekukan saat checkout. Bila metode/rekening sudah dinonaktifkan
     * admin, jatuh ke metode bertipe transfer manual aktif pertama (berlaku untuk semua mata uang, ASUMSI A-86) dan
     * rekening aktif pertama se-mata-uang. Tidak ada keduanya → 409 FREIGHT_PAYMENT_UNAVAILABLE (penawaran tetap terbuka).
     *
     * @return array{0: PaymentMethod, 1: \App\Models\BankAccount|null}
     *
     * @throws ApiException 409 FREIGHT_PAYMENT_UNAVAILABLE
     */
    private function resolvePendingPayment(Order $order): array
    {
        $pending = is_array($order->pending_payment_method) ? $order->pending_payment_method : [];
        $currency = $order->currencyCode();
        try {
            $method = $this->payments->resolveMethod($pending['code'] ?? null, $currency);
        } catch (ValidationException $e) {
            $method = PaymentMethod::active()->where('type', PaymentMethod::TYPE_MANUAL_TRANSFER)->orderBy('sort_order')->orderBy('id')->first();
        }
        if (! $method || (! Money::isIdr($currency) && ! $method->isManualTransfer())) {
            throw $this->paymentUnavailable($currency, 'paymentMethod');
        }
        $bankId = isset($pending['bankAccountId']) ? (int) $pending['bankAccountId'] : null;
        try {
            $bank = $this->payments->resolveBankAccount($method, $bankId, $currency);
        } catch (ValidationException $e) {
            try {
                // Rekening pilihan checkout sudah nonaktif: rekening aktif pertama se-mata-uang.
                $bank = $bankId ? $this->payments->resolveBankAccount($method, null, $currency) : null;
            } catch (ValidationException $e) {
                $bank = null;
            }
            if (! $bank) {
                throw $this->paymentUnavailable($currency, 'bankAccount');
            }
        }

        return [$method, $bank];
    }

    private function paymentUnavailable(string $currency, string $missing): ApiException
    {
        return ApiException::conflict('FREIGHT_PAYMENT_UNAVAILABLE', __('commerce.freight_payment_unavailable', ['currency' => $currency]), [
            'currency' => $currency,
            'missing' => $missing,
        ]);
    }

    /** @return array<int, array{label:string, amount:int}> */
    private function normalizeLines(array $lines): array
    {
        $out = [];
        foreach ($lines as $line) {
            if (! is_array($line)) {
                continue;
            }
            $label = trim(preg_replace('/\s+/u', ' ', (string) ($line['label'] ?? '')));
            if ($label === '') {
                continue;
            }
            $out[] = ['label' => mb_substr($label, 0, 80), 'amount' => max(0, (int) ($line['amount'] ?? 0))];
        }

        return $out;
    }

    private function cleanNote(?string $note): ?string
    {
        $note = trim((string) $note);

        return $note === '' ? null : mb_substr($note, 0, 1000);
    }

    private function dbTime(Carbon $time): string
    {
        return $time->copy()->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s');
    }
}
