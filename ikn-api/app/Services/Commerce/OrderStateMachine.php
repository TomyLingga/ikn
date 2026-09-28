<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Stock\StockLedger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Satu-satunya pintu perubahan status order (arsitektur 7.1). Efek samping (stok, voucher, payment, invoice,
 * histori, audit, email) selalu sama apa pun pemicunya (customer, admin, scheduler, webhook).
 *
 * | Dari → Ke                                | Efek samping                                                        |
 * | ∅ → pending_payment                      | histori awal, email customer + admin (stok/voucher direserve CheckoutService) |
 * | pending_payment → payment_review         | email admin (payment sudah awaiting_verification oleh PaymentService) |
 * | payment_review → paid                    | commit stok + voucher, paid_at, invoice_number, email customer       |
 * | payment_review → pending_payment         | (payment rejected oleh PaymentService) email customer dengan alasan  |
 * | pending_payment → expired                | release stok + voucher (idempoten), payment aktif expired, email     |
 * | pending_payment/payment_review → cancelled | release stok + voucher, payment aktif cancelled, email             |
 * | paid/processing → cancelled              | adjust +qty (key order:{id}:cancel-return:{product}), email (refund manual) |
 * | paid → processing → shipped → delivered → completed | histori; shipped wajib kurir + resi; email shipped/delivered/completed |
 */
class OrderStateMachine
{
    public const TRANSITIONS = [
        '' => [Order::STATUS_PENDING_PAYMENT],
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
     * @param  array  $meta  courier, trackingNumber, reason, paymentId, note, actorType (user|system|webhook), source
     *
     * @throws ApiException 409 INVALID_TRANSITION meta {from,to}
     * @throws ValidationException shipped tanpa kurir/resi
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
                case Order::STATUS_PENDING_PAYMENT:
                    $note = $note ?? ($isInitial
                        ? __('commerce.note.placed', [], $locale)
                        : __('commerce.note.rejected', ['reason' => $meta['reason'] ?? '-'], $locale));
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
                    $note = $note ?? __('commerce.note.delivered', [], $locale);
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

            return ['order' => $locked, 'from' => $from, 'wasPaid' => $wasPaid, 'meta' => $meta];
        });

        /** @var Order $result */
        $result = $context['order'];
        $result->unsetRelation('histories');
        $result->unsetRelation('items');
        $this->notify($result, $context['from'], $to, $context['meta'], $context['wasPaid']);

        // Sinkronkan instance pemanggil agar controller/service melihat status terbaru.
        $order->setRawAttributes($result->getAttributes(), true);
        foreach (['histories', 'items', 'payments', 'reviews'] as $relation) {
            if ($order->relationLoaded($relation)) {
                $order->unsetRelation($relation);
            }
        }

        return $order;
    }

    private function notify(Order $order, ?string $from, string $to, array $meta, bool $wasPaid): void
    {
        switch ($to) {
            case Order::STATUS_PENDING_PAYMENT:
                if ($from === null) {
                    $this->notifier->orderPlaced($order);
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
                $this->notifier->orderCancelled($order, $meta['reason'] ?? null, $wasPaid);
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
