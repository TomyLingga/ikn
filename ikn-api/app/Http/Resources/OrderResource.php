<?php

namespace App\Http\Resources;

use App\Models\DeliveryTerm;
use App\Models\Order;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bentuk `Order` lengkap (kontrak bagian 9, superset tipe FE): items, payments[], activePayment (+ alias `payment`),
 * timeline[], shippingAddress, shippingMethod (+ origins[]), deliveryTerm, paymentTerm, pickup, pickupPoints[], proforma, shipmentDetails, destinationPort,
 * freightQuotes[] + activeFreightQuote (CIF, A-89), flag can*. Semua uang integer satuan terkecil
 * `currency` (IDR rupiah, USD sen; ASUMSI A-86), tanggal ISO-8601 +07:00.
 */
class OrderResource extends JsonResource
{
    /**
     * Cara serah terima order (ASUMSI A-85): kode dari kolom, keluarga/cara biaya dari snapshot; nama dan pelabuhan
     * muat dari baris delivery_terms bila masih ada (order lama hasil backfill tidak punya snapshot term).
     */
    public static function deliveryTerm(Order $order): ?array
    {
        $shipping = $order->shipping_snapshot ?? [];
        $code = $order->delivery_term ?: ($shipping['term'] ?? null);
        if (! $code) {
            return null;
        }
        $row = DeliveryTerm::where('code', $code)->first();

        return [
            'code' => $code,
            'name' => $row?->name,
            'family' => $shipping['family'] ?? $row?->family,
            'pricingMode' => $shipping['pricingMode'] ?? $row?->pricing_mode,
            'loadingPort' => $row?->loading_port,
        ];
    }

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
        $activeQuote = null;

        return [
            'id' => $order->id,
            'number' => $order->number,
            'invoiceNumber' => $order->invoice_number,
            'date' => optional($order->created_at)->toApiString(),
            'status' => $order->status,
            'paymentStatus' => $order->payment_status,
            'locale' => $order->locale,
            'currency' => $order->currencyCode(),
            'customer' => [
                'id' => $order->user_id,
                'name' => $order->customerName(),
                'company' => $order->customerCompany(),
                'pic' => $order->customerPic(),
                'email' => $order->customerEmail(),
                'phone' => $order->customer_snapshot['phone'] ?? null,
                'taxId' => $order->customer_snapshot['taxId'] ?? null,
                'market' => $order->customer_snapshot['market'] ?? null,
                'countryCode' => $order->customer_snapshot['countryCode'] ?? null,
                'companyAddress' => $order->customer_snapshot['companyAddress'] ?? null,
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
                // Rincian ongkir zona per pabrik asal (ASUMSI A-90); null untuk order sebelum A-90 dan term tanpa tarif zona.
                'origins' => $shipping['origins'] ?? null,
                // CIF (ASUMSI A-89): rincian baris ongkir yang disepakati + id penawaran; null sebelum disepakati / untuk term lain.
                'lines' => $shipping['lines'] ?? null,
                'quoteId' => $shipping['quoteId'] ?? null,
            ] : null,
            'shippingAddress' => $order->shipping_address_snapshot,
            // Pelabuhan tujuan CIF yang dipilih customer saat checkout (ASUMSI A-89); null untuk term lain.
            'destinationPort' => $order->destinationPort(),
            'deliveryTerm' => self::deliveryTerm($order),
            // Syarat pembayaran ekspor yang dibekukan saat checkout (ASUMSI A-87); null untuk order lokal.
            'paymentTerm' => $order->paymentTerm(),
            // Titik ambil Loco yang dibekukan saat checkout; null untuk order diantar.
            'pickup' => $order->pickupPoint(),
            // Semua titik ambil, satu per pabrik asal item (ASUMSI A-90); [] untuk order diantar. `pickup` = titik pertama.
            'pickupPoints' => $order->pickupPoints(),
            'courier' => $order->courier,
            'trackingNumber' => $order->tracking_number,
            // Order FOB/CIF (ASUMSI A-88): data kapal/B/L saat shipped on board; null untuk order darat/Loco atau sebelum dikirim.
            'isPort' => $order->isPort(),
            'shipmentDetails' => $order->shipmentDetails(),
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
            // Proforma invoice yang bisa diedit admin (ASUMSI A-88): nomor PI/{order} tetap + revisi; null sebelum pertama disimpan.
            'proforma' => $order->proforma ? $order->proforma->setRelation('order', $order)->toSummary() : null,
            'canEditProforma' => $order->canEditProforma(),
            // Penawaran ongkir CIF (ASUMSI A-89): semua putaran (terbaru dulu), yang masih proposed, metode bayar yang
            // ditunda sampai penawaran disetujui, dan flag aksi customer/admin.
            'freightQuotes' => $order->freightQuotes->map(fn ($q) => $q->toSummary())->values()->all(),
            'activeFreightQuote' => ($activeQuote = $order->activeFreightQuote()) ? $activeQuote->toSummary() : null,
            'pendingPaymentMethod' => is_array($order->pending_payment_method) ? [
                'code' => $order->pending_payment_method['code'] ?? null,
                'bankAccountId' => isset($order->pending_payment_method['bankAccountId']) ? (int) $order->pending_payment_method['bankAccountId'] : null,
            ] : null,
            'canAcceptFreightQuote' => $order->canAcceptFreightQuote(),
            'canCounterFreightQuote' => $order->canCounterFreightQuote(),
            'canQuoteFreight' => $order->canQuoteFreight(),
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
            'items', 'reviews', 'histories.actor', 'trackingUpdates.author', 'attachments.media', 'attachments.author', 'proforma.editor', 'freightQuotes.creator',
            'payments.paymentMethod', 'payments.bankAccount', 'payments.proof', 'payments.verifier',
        ];
    }
}
