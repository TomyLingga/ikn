<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Baris daftar order (customer & admin, dashboard, laporan): tanpa payments/timeline penuh.
 * Butuh with(self::eager()) untuk itemsCount/activePayment/canReview yang murah.
 */
class OrderSummaryResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var Order $order */
        $order = $this->resource;
        $active = $order->relationLoaded('payments') ? $order->activePayment() : null;
        $items = $order->relationLoaded('items') ? $order->items : collect();

        return [
            'id' => $order->id,
            'number' => $order->number,
            'invoiceNumber' => $order->invoice_number,
            'date' => optional($order->created_at)->toApiString(),
            'status' => $order->status,
            'paymentStatus' => $order->payment_status,
            'customer' => [
                'id' => $order->user_id,
                'name' => $order->customerName(),
                'company' => $order->customerCompany(),
                'pic' => $order->customerPic(),
                'email' => $order->customerEmail(),
            ],
            'itemsCount' => $items->count(),
            'items' => $items->map(fn ($item) => [
                'productSlug' => $item->productSlug(),
                'name' => $item->productName(),
                'code' => $item->product_snapshot['code'] ?? null,
                'image' => $item->product_snapshot['image'] ?? null,
                'qty' => $item->qty,
                'unit' => $item->product_snapshot['unit'] ?? null,
                'unitPrice' => $item->unitPriceInt(),
                'lineTotal' => $item->lineTotalInt(),
            ])->values()->all(),
            'subtotal' => $order->subtotalInt(),
            'grandTotal' => $order->grandTotalInt(),
            'paymentMethod' => $active?->method ?? $order->latestPayment()?->method,
            'paymentDueAt' => optional($order->payment_due_at)->toApiString(),
            'paidAt' => optional($order->paid_at)->toApiString(),
            'courier' => $order->courier,
            'trackingNumber' => $order->tracking_number,
            // Flag aksi untuk tombol cepat di daftar "Pesanan saya" (sama artinya dengan OrderResource).
            'canCancel' => $order->canCancel(),
            'canUploadProof' => $order->relationLoaded('payments') ? $order->canUploadProof() : null,
            'canConfirmReceived' => $order->canConfirmReceived(),
            'canComplete' => $order->canComplete(),
            'canReview' => $order->relationLoaded('reviews') && $order->relationLoaded('items') ? $order->canReview() : null,
            'createdAt' => optional($order->created_at)->toApiString(),
            'updatedAt' => optional($order->updated_at)->toApiString(),
        ];
    }

    public static function eager(): array
    {
        return ['items', 'payments', 'reviews'];
    }
}
