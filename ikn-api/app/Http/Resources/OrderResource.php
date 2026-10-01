<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bentuk `Order` lengkap (kontrak bagian 9, superset tipe FE): items, payments[], activePayment (+ alias `payment`),
 * timeline[], shippingAddress, shippingMethod, flag can*. Semua uang integer rupiah, tanggal ISO-8601 +07:00.
 */
class OrderResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var Order $order */
        $order = $this->resource;
        $order->loadMissing(self::eager());
        foreach ($order->items as $item) {
            $item->setRelation('order', $order);
        }
        $active = $order->activePayment();
        $shipping = $order->shipping_snapshot;

        return [
            'id' => $order->id,
            'number' => $order->number,
            'invoiceNumber' => $order->invoice_number,
            'date' => optional($order->created_at)->toApiString(),
            'status' => $order->status,
            'paymentStatus' => $order->payment_status,
            'locale' => $order->locale,
            'customer' => [
                'id' => $order->user_id,
                'name' => $order->customerName(),
                'company' => $order->customerCompany(),
                'pic' => $order->customerPic(),
                'email' => $order->customerEmail(),
                'phone' => $order->customer_snapshot['phone'] ?? null,
                'taxId' => $order->customer_snapshot['taxId'] ?? null,
            ],
            'items' => OrderItemResource::collection($order->items)->resolve(),
            'subtotal' => $order->subtotalInt(),
            'discountTotal' => $order->discountTotalInt(),
            'shippingTotal' => $order->shippingTotalInt(),
            'feeTotal' => $order->feeTotalInt(),
            'fees' => $order->fees_snapshot ?? [],
            'taxTotal' => $order->taxTotalInt(),
            'taxRate' => $order->taxRateNumber(),
            'priceIncludesTax' => (bool) $order->price_includes_tax,
            'uniqueCode' => (int) $order->unique_code,
            'grandTotal' => $order->grandTotalInt(),
            'voucherCode' => $order->voucher_code,
            'shippingMethod' => $shipping ? [
                'rateId' => $shipping['rateId'] ?? null,
                'zoneId' => $shipping['zoneId'] ?? null,
                'label' => $shipping['label'] ?? null,
                'eta' => $shipping['eta'] ?? null,
                'amount' => (int) ($shipping['amount'] ?? $order->shippingTotalInt()),
                'type' => $shipping['type'] ?? null,
                'weightGram' => (int) ($shipping['weightGram'] ?? 0),
                'volumeCm3' => (int) ($shipping['volumeCm3'] ?? 0),
                'distanceKm' => isset($shipping['distanceKm']) ? (int) $shipping['distanceKm'] : null,
                'breakdown' => $shipping['breakdown'] ?? null,
            ] : null,
            'shippingAddress' => $order->shipping_address_snapshot,
            'courier' => $order->courier,
            'trackingNumber' => $order->tracking_number,
            'note' => $order->note,
            'cancelReason' => $order->cancel_reason,
            'paymentDueAt' => optional($order->payment_due_at)->toApiString(),
            'paidAt' => optional($order->paid_at)->toApiString(),
            'shippedAt' => optional($order->shipped_at)->toApiString(),
            'deliveredAt' => optional($order->delivered_at)->toApiString(),
            'completedAt' => optional($order->completed_at)->toApiString(),
            'cancelledAt' => optional($order->cancelled_at)->toApiString(),
            'expiredAt' => optional($order->expired_at)->toApiString(),
            'activePayment' => $active ? (new PaymentResource($active))->resolve() : null,
            'payment' => $active ? (new PaymentResource($active))->resolve() : null, // alias kontrak bagian 9 (contoh 201)
            'payments' => PaymentResource::collection($order->payments)->resolve(),
            'timeline' => $order->histories->map(fn ($h) => [
                'id' => $h->id,
                'status' => $h->to_status,
                'fromStatus' => $h->from_status,
                'at' => optional($h->created_at)->toApiString(),
                'note' => $h->note,
                'actorType' => $h->actor_type,
                'actor' => $h->actor ? ['id' => $h->actor->id, 'name' => $h->actor->name] : null,
                'meta' => $h->meta,
            ])->values()->all(),
            // Catatan perjalanan dari admin di antara "Dikirim" dan "Diterima" (ASUMSI A-70).
            'trackingUpdates' => $order->trackingUpdates->map(fn ($u) => $u->toSummary())->values()->all(),
            // Lampiran admin (ASUMSI A-74); berkas privat, diunduh lewat GET /files/{media}.
            'attachments' => $order->attachments->map(fn ($a) => $a->toSummary())->values()->all(),
            'canAttach' => in_array($order->status, Order::PAID_STATUSES, true),
            'canAddTracking' => $order->canAddTracking(),
            'canCancel' => $order->canCancel(),
            'canUploadProof' => $order->canUploadProof(),
            'canChangePayment' => $order->canChangePayment(),
            'canConfirmReceived' => $order->canConfirmReceived(),
            'canComplete' => $order->canComplete(),
            'canReview' => $order->canReview(),
            'createdAt' => optional($order->created_at)->toApiString(),
            'updatedAt' => optional($order->updated_at)->toApiString(),
        ];
    }

    public static function eager(): array
    {
        return [
            'items', 'reviews', 'histories.actor', 'trackingUpdates.author', 'attachments.media', 'attachments.author',
            'payments.paymentMethod', 'payments.bankAccount', 'payments.proof', 'payments.verifier',
        ];
    }
}
