<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Baris GET /admin/payments dan detail GET /admin/payments/{id} (kontrak 11.2): payment + order ringkas
 * { number, status, customer{name,company,email}, grandTotal, paymentDueAt } + proofUrl (/api/v1/files/{mediaId}).
 */
class AdminPaymentResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var Payment $payment */
        $payment = $this->resource;
        $order = $payment->order;

        return (new PaymentResource($payment))->resolve() + [
            'proofUrl' => $payment->proof ? $payment->proof->url() : null,
            'order' => $order ? [
                'id' => $order->id,
                'number' => $order->number,
                'invoiceNumber' => $order->invoice_number,
                'status' => $order->status,
                'paymentStatus' => $order->payment_status,
                'customer' => [
                    'id' => $order->user_id,
                    'name' => $order->customerName(),
                    'company' => $order->customerCompany(),
                    'pic' => $order->customerPic(),
                    'email' => $order->customerEmail(),
                ],
                'grandTotal' => $order->grandTotalInt(),
                'uniqueCode' => (int) $order->unique_code,
                'paymentDueAt' => optional($order->payment_due_at)->toApiString(),
                'paidAt' => optional($order->paid_at)->toApiString(),
                'date' => optional($order->created_at)->toApiString(),
            ] : null,
        ];
    }

    public static function eager(): array
    {
        return array_merge(PaymentResource::eager(), ['order']);
    }
}
