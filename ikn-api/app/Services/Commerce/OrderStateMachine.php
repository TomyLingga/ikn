<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Stock\StockLedger;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Satu-satunya pintu perubahan status order (arsitektur 7.1). Efek samping (stok, voucher, payment, invoice,
 * histori, audit, email) selalu sama apa pun pemicunya (customer, admin, scheduler, webhook).
 *
 * | Dari → Ke                                | Efek samping                                                        |
 * | ∅ → pending_payment                      | histori awal, email customer + admin (stok/voucher direserve CheckoutService) |
 * | ∅ → awaiting_freight (CIF, A-89)         | histori awal, email customer "menunggu penawaran ongkir" + email admin (stok direserve, belum ada payment) |
 * | awaiting_freight → pending_payment       | penawaran ongkir disetujui (FreightQuoteService: shipping_total, payment, payment_due_at), email instruksi bayar |
 * | awaiting_freight → cancelled             | release stok, penawaran terbuka → rejected; customer/admin/scheduler batas tunggu   |
 * | pending_payment → payment_review         | email admin (payment sudah awaiting_verification oleh PaymentService) |
 * | payment_review → paid                    | commit stok + voucher, paid_at, invoice_number, email customer       |
 * | payment_review → pending_payment         | (payment rejected oleh PaymentService) email customer dengan alasan  |
 * | pending_payment → expired                | release stok + voucher (idempoten), payment aktif expired, email     |
 * | pending_payment/payment_review → cancelled | release stok + voucher, payment aktif cancelled, email             |
 * | paid/processing → cancelled              | adjust +qty (key order:{id}:cancel-return:{product}), email (refund manual) |
 * | paid → processing → shipped → delivered → completed | histori; shipped wajib kurir + resi; email shipped/delivered/completed |
 * | (order Loco, ASUMSI A-85)                | shipped tanpa kurir/resi = "siap diambil", delivered = "sudah diambil"      |
 * | (order FOB/CIF, ASUMSI A-88)             | shipped wajib nama kapal + nomor B/L (shipment_details, tracking_number = B/L) |
 */
class OrderStateMachine
{
    public const TRANSITIONS = [
        '' => [Order::STATUS_AWAITING_FREIGHT, Order::STATUS_PENDING_PAYMENT],
        Order::STATUS_AWAITING_FREIGHT => [Order::STATUS_PENDING_PAYMENT, Order::STATUS_CANCELLED],
        Order::STATUS_PENDING_PAYMENT => [Order::STATUS_PAYMENT_REVIEW, Order::STATUS_EXPIRED, Order::STATUS_CANCELLED],
        Order::STATUS_PAYMENT_REVIEW => [Order::STATUS_PAID, Order::STATUS_PENDING_PAYMENT, Order::STATUS_CANCELLED],
        Order::STATUS_PAID => [Order::STATUS_PROCESSING, Order::STATUS_CANCELLED],
        Order::STATUS_PROCESSING => [Order::STATUS_SHIPPED, Order::STATUS_CANCELLED],
        Order::STATUS_SHIPPED => [Order::STATUS_DELIVERED],
        Order::STATUS_DELIVERED => [Order::STATUS_COMPLETED],
        Order::STATUS_COMPLETED => [],
        Order::STATUS_CANCELLED => [],
        Order::STATUS_EXPIRED => [],
    ];

    public function __construct(
        private StockLedger $ledger,
        private VoucherService $vouchers,
        private InvoiceNumberGenerator $invoices,
        private OrderNotifier $notifier,
        private AuditLogger $audit,
    ) {
    }

    public static function canTransition(?string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[(string) $from] ?? [], true);
    }

    /**
     * @param  array  $meta  courier, trackingNumber, vesselName, voyage, blNumber, blDate, reason, paymentId, quoteId, freightTotal, acceptedBy, note, actorType (user|system|webhook), source
     *
     * @throws ApiException 409 INVALID_TRANSITION meta {from,to}
     * @throws ValidationException shipped tanpa kurir/resi (order darat) atau tanpa nama kapal/B/L (order FOB/CIF)
     */
    public function transition(Order $order, string $to, ?User $actor = null, array $meta = []): Order
    {
        if (! in_array($to, Order::STATUSES, true)) {
            throw new InvalidArgumentException("Unknown order status '{$to}'.");
        }

        $actorType = $meta['actorType'] ?? ($actor ? OrderStatusHistory::ACTOR_USER : OrderStatusHistory::ACTOR_SYSTEM);
        $note = $meta['note'] ?? null;
        unset($meta['actorType'], $meta['note']);

        $context = DB::transaction(function () use ($order, $to, $actor, $actorType, $note, $meta) {
            // Kunci baris order agar dua transisi bersamaan (mis. admin accept vs scheduler expire) terurut.
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();
            if (! $locked) {
                throw ApiException::notFound();
            }

            $isInitial = ! $locked->histories()->exists();
            $from = $isInitial ? null : $locked->status;

            if (! self::canTransition($from, $to)) {
                throw ApiException::conflict('INVALID_TRANSITION', __('commerce.invalid_transition', ['from' => $from ?? '∅', 'to' => $to]), [
                    'from' => $from,
                    'to' => $to,
                ]);
            }

            $locale = $locked->preferredLocale();
            $now = now();
            $historyMeta = array_filter($meta, fn ($v) => $v !== null && $v !== '');
            $wasPaid = false;

            switch ($to) {
                case Order::STATUS_AWAITING_FREIGHT:
                    // CIF (ASUMSI A-89): stok sudah direserve CheckoutService; payment dibuat saat penawaran diterima.
                    $note = $note ?? __('commerce.note.freight_requested', ['port' => $locked->destinationPort()['name'] ?? '-'], $locale);
                    break;

                case Order::STATUS_PENDING_PAYMENT:
                    if ($isInitial) {
                        $note = $note ?? __('commerce.note.placed', [], $locale);
                    } elseif ($from === Order::STATUS_AWAITING_FREIGHT) {
                        $note = $note ?? __('commerce.note.freight_accepted', ['total' => Money::format((int) ($meta['freightTotal'] ?? $locked->shippingTotalInt()), $locked->currencyCode())], $locale);
                    } else {
                        $note = $note ?? __('commerce.note.rejected', ['reason' => $meta['reason'] ?? '-'], $locale);
                    }
                    break;

                case Order::STATUS_PAYMENT_REVIEW:
                    $note = $note ?? __('commerce.note.'.(($meta['source'] ?? null) === 'gateway' ? 'gateway_pending' : 'proof_uploaded'), [], $locale);
                    break;

                case Order::STATUS_PAID:
                    foreach ($locked->items as $item) {
                        $product = $this->productOf($item);
                        $this->ledger->commit($product, $item->qty, $locked, $actor);
                    }
                    $this->vouchers->commit($locked->id);
                    $locked->paid_at = $meta['paidAt'] ?? $now;
                    if (! $locked->invoice_number) {
                        $locked->invoice_number = $this->invoices->next($locked->paid_at);
                    }
                    $note = $note ?? __('commerce.note.'.($actorType === OrderStatusHistory::ACTOR_WEBHOOK ? 'gateway_paid' : 'accepted'), [], $locale);
                    break;

                case Order::STATUS_EXPIRED:
                    $this->releaseReservations($locked, $actor);
                    $this->closeActivePayments($locked, Payment::STATUS_EXPIRED);
                    $locked->expired_at = $now;
                    $note = $note ?? __('commerce.note.expired', [], $locale);
                    break;

                case Order::STATUS_CANCELLED:
                    $wasPaid = in_array($from, Order::PAID_STATUSES, true);
                    if ($wasPaid) {
                        // Stok sudah di-commit: kembalikan lewat adjust (+qty) dengan kunci idempoten, bukan release.
                        foreach ($locked->items as $item) {
                            $this->ledger->adjust(
                                $this->productOf($item),
                                $item->qty,
                                __('commerce.note.cancel_return_stock', ['number' => $locked->number], 'id'),
                                $actor,
                                sprintf('order:%d:cancel-return:%d', $locked->id, $item->product_id)
                            );
                        }
                    } else {
                        $this->releaseReservations($locked, $actor);
                    }
                    if ($from === Order::STATUS_AWAITING_FREIGHT) {
                        // Penawaran ongkir yang masih terbuka ditutup bersama order (ASUMSI A-89).
                        OrderFreightQuote::where('order_id', $locked->id)->where('status', OrderFreightQuote::STATUS_PROPOSED)->update([
                            'status' => OrderFreightQuote::STATUS_REJECTED,
                            'responded_at' => $now->copy()->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s'),
                            'updated_at' => $now->copy()->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s'),
                        ]);
                    }
                    $this->closeActivePayments($locked, Payment::STATUS_CANCELLED);
                    $locked->cancelled_at = $now;
                    $locked->cancel_reason = $meta['reason'] ?? null;
                    $note = $note ?? (isset($meta['reason']) && $meta['reason'] !== ''
                        ? __('commerce.note.cancelled', ['reason' => $meta['reason']], $locale)
                        : __('commerce.note.cancelled_no_reason', [], $locale));
                    break;

                case Order::STATUS_PROCESSING:
                    $note = $note ?? __('commerce.note.processing', [], $locale);
                    break;

                case Order::STATUS_SHIPPED:
                    // Data kapal hanya dicatat untuk order FOB/CIF; untuk Loco/darat diabaikan.
                    unset($historyMeta['vesselName'], $historyMeta['voyage'], $historyMeta['blNumber'], $historyMeta['blDate']);
                    if ($locked->isPickup()) {
                        // Loco: barang siap diambil di pabrik; tidak ada kurir maupun resi.
                        $locked->courier = null;
                        $locked->tracking_number = null;
                        $locked->shipped_at = $now;
                        unset($historyMeta['courier'], $historyMeta['trackingNumber']);
                        $note = $note ?? __('commerce.note.ready_for_pickup', ['label' => $locked->pickupLabel($locale)], $locale);
                        break;
                    }
                    if ($locked->isPort()) {
                        // FOB/CIF (ASUMSI A-88): dimuat ke kapal; nama kapal + nomor B/L menggantikan kurir + resi.
                        $details = is_array($locked->shipment_details) ? $locked->shipment_details : [];
                        $vessel = trim((string) ($meta['vesselName'] ?? $details['vessel'] ?? ''));
                        $bl = trim((string) ($meta['blNumber'] ?? $details['blNumber'] ?? ''));
                        if ($vessel === '' || $bl === '') {
                            throw ValidationException::withMessages([
                                $vessel === '' ? 'vesselName' : 'blNumber' => [__('commerce.vessel_required')],
                            ]);
                        }
                        $voyage = trim((string) ($meta['voyage'] ?? $details['voyage'] ?? ''));
                        $blDate = ! empty($meta['blDate']) ? Carbon::parse($meta['blDate'], config('app.timezone'))->startOfDay() : null;
                        $locked->shipment_details = ['vessel' => $vessel, 'voyage' => $voyage !== '' ? $voyage : null, 'blNumber' => $bl, 'blDate' => $blDate?->toDateString()];
                        $locked->courier = null;
                        $locked->tracking_number = $bl; // kolom daftar yang sudah ada menampilkan nomor B/L
                        $locked->shipped_at = $blDate ? $blDate->copy()->setTimeFrom($now) : $now;
                        unset($historyMeta['courier'], $historyMeta['trackingNumber']);
                        $historyMeta = array_filter(['vesselName' => $vessel, 'voyage' => $voyage, 'blNumber' => $bl, 'blDate' => $blDate?->toDateString()], fn ($v) => $v !== null && $v !== '') + $historyMeta;
                        $note = $note ?? __('commerce.note.shipped_on_board', ['vessel' => $vessel, 'bl' => $bl], $locale);
                        break;
                    }
                    $courier = trim((string) ($meta['courier'] ?? $locked->courier ?? ''));
                    $tracking = trim((string) ($meta['trackingNumber'] ?? $locked->tracking_number ?? ''));
                    if ($courier === '' || $tracking === '') {
                        throw ValidationException::withMessages([
                            $courier === '' ? 'courier' : 'trackingNumber' => [__('commerce.shipping_required')],
                        ]);
                    }
                    $locked->courier = $courier;
                    $locked->tracking_number = $tracking;
                    $locked->shipped_at = $now;
                    $historyMeta['courier'] = $courier;
                    $historyMeta['trackingNumber'] = $tracking;
                    $note = $note ?? __('commerce.note.shipped', ['courier' => $courier, 'tracking' => $tracking], $locale);
                    break;

                case Order::STATUS_DELIVERED:
                    $locked->delivered_at = $now;
                    $note = $note ?? __('commerce.note.'.($locked->isPickup() ? 'picked_up' : 'delivered'), [], $locale);
                    break;

                case Order::STATUS_COMPLETED:
                    $locked->completed_at = $now;
                    $note = $note ?? ($actorType === OrderStatusHistory::ACTOR_SYSTEM
                        ? __('commerce.note.auto_completed', ['days' => $meta['days'] ?? 0], $locale)
                        : __('commerce.note.completed', [], $locale));
                    break;
            }

            $locked->status = $to;
            $locked->syncPaymentStatus();
            $locked->save();

            $locked->histories()->create([
                'from_status' => $from,
                'to_status' => $to,
                'note' => $note,
                'actor_type' => $actorType,
                'actor_id' => $actor?->id,
                'meta' => $historyMeta ?: null,
                'created_at' => $now,
            ]);

            if ($actorType !== OrderStatusHistory::ACTOR_USER) {
                $this->audit->log(null, 'order.'.$to.' ['.$actorType.']', $locked, ['status' => $from], ['status' => $to] + $historyMeta);
            }

            return ['order' => $locked, 'from' => $from, 'wasPaid' => $wasPaid, 'meta' => $meta, 'actorType' => $actorType];
        });

        /** @var Order $result */
        $result = $context['order'];
        $result->unsetRelation('histories');
        $result->unsetRelation('items');
        $this->notify($result, $context['from'], $to, $context['meta'], $context['wasPaid'], $context['actorType']);

        // Sinkronkan instance pemanggil agar controller/service melihat status terbaru.
        $order->setRawAttributes($result->getAttributes(), true);
        foreach (['histories', 'items', 'payments', 'reviews'] as $relation) {
            if ($order->relationLoaded($relation)) {
                $order->unsetRelation($relation);
            }
        }

        return $order;
    }

    private function notify(Order $order, ?string $from, string $to, array $meta, bool $wasPaid, string $actorType = OrderStatusHistory::ACTOR_USER): void
    {
        switch ($to) {
            case Order::STATUS_AWAITING_FREIGHT:
                $this->notifier->freightRequested($order);
                break;
            case Order::STATUS_PENDING_PAYMENT:
                if ($from === null) {
                    $this->notifier->orderPlaced($order);
                } elseif ($from === Order::STATUS_AWAITING_FREIGHT) {
                    $quote = isset($meta['quoteId']) ? OrderFreightQuote::find($meta['quoteId']) : $order->freightQuotes()->where('status', OrderFreightQuote::STATUS_ACCEPTED)->first();
                    $this->notifier->freightAccepted($order, $quote, (string) ($meta['acceptedBy'] ?? OrderFreightQuote::BY_CUSTOMER));
                } elseif (isset($meta['paymentId']) && ($payment = Payment::find($meta['paymentId']))) {
                    $this->notifier->paymentRejected($order, $payment, (string) ($meta['reason'] ?? ''));
                }
                break;
            case Order::STATUS_PAYMENT_REVIEW:
                $payment = isset($meta['paymentId']) ? Payment::find($meta['paymentId']) : $order->activePayment();
                if ($payment) {
                    $this->notifier->paymentReceived($order, $payment);
                }
                break;
            case Order::STATUS_PAID:
                $this->notifier->paymentAccepted($order);
                break;
            case Order::STATUS_EXPIRED:
                $this->notifier->orderExpired($order);
                break;
            case Order::STATUS_CANCELLED:
                // Batal otomatis karena batas tunggu penawaran ongkir terlewati memakai teks notifikasi tersendiri (A-89).
                $this->notifier->orderCancelled($order, $meta['reason'] ?? null, $wasPaid, $from === Order::STATUS_AWAITING_FREIGHT && $actorType === OrderStatusHistory::ACTOR_SYSTEM);
                break;
            case Order::STATUS_SHIPPED:
                $this->notifier->orderShipped($order);
                break;
            case Order::STATUS_DELIVERED:
                $this->notifier->orderDelivered($order);
                break;
            case Order::STATUS_COMPLETED:
                $this->notifier->orderCompleted($order);
                break;
        }
    }

    /** Release stok + kuota voucher (keduanya idempoten per order). */
    private function releaseReservations(Order $order, ?User $actor): void
    {
        foreach ($order->items as $item) {
            $this->ledger->release($this->productOf($item), $item->qty, $order, $actor);
        }
        $this->vouchers->release($order->id);
    }

    private function closeActivePayments(Order $order, string $status): void
    {
        Payment::where('order_id', $order->id)->whereIn('status', Payment::ACTIVE_STATUSES)->update([
            'status' => $status,
            'updated_at' => now()->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s'),
        ]);
    }

    private function productOf(OrderItem $item): Product
    {
        $product = Product::withTrashed()->find($item->product_id);
        if (! $product) {
            throw ApiException::notFound();
        }

        return $product;
    }
}
