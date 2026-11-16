<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Models\OrderInstallment;
use App\Models\Payment;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Satu termin order (ASUMSI A-97) di dalam OrderResource.installments[]: jadwal, nominal (satuan terkecil + currency),
 * status + overdue, tanggal, percobaan bayar termin itu (payments[], activePayment), dan flag aksi.
 * Pemanggil memasang relasi `order` dan `payments` (dari payments order yang sudah dimuat) agar tanpa query tambahan.
 */
class OrderInstallmentResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var OrderInstallment $row */
        $row = $this->resource;
        /** @var Order $order */
        $order = $row->order;
        $payments = $row->payments;
        $active = $payments->whereIn('status', Payment::ACTIVE_STATUSES)->sortByDesc('id')->first();
        $latest = $payments->sortByDesc('id')->first();
        $inProgress = in_array($order->status, Order::IN_PROGRESS_STATUSES, true);
        $manual = $latest === null || $latest->isManual();

        return [
            'id' => $row->id,
            'seq' => (int) $row->seq,
            'key' => $row->key,
            'label' => $row->label,
            'percent' => $row->percentNumber(),
            'amount' => $row->amountInt(),
            'currency' => $row->currencyCode(),
            'trigger' => $row->trigger,
            'dueDays' => (int) $row->due_days,
            'status' => $row->status,
            // Diturunkan: sedang ditagih dan tanggal jatuh tempo sudah lewat.
            'overdue' => $row->isOverdue(),
            'dueAt' => optional($row->due_at)->toApiString(),
            'billedAt' => optional($row->billed_at)->toApiString(),
            'paidAt' => optional($row->paid_at)->toApiString(),
            'remindedAt' => optional($row->reminded_at)->toApiString(),
            'reminderCount' => (int) $row->reminder_count,
            'activePayment' => $active ? (new PaymentResource($active))->resolve() : null,
            'payments' => PaymentResource::collection($payments->values())->resolve(),
            // Customer: termin pertama mengikuti aturan order (pending_payment, belum lewat batas); termin lanjutan
            // selama sedang ditagih dan order masih berjalan (terlambat tetap boleh dibayar).
            'canUploadProof' => $row->isDue() && $manual && ($row->isFirst() ? $order->canUploadProof() : $inProgress),
            // Admin: tagih lebih awal, ubah jatuh tempo, kirim pengingat (termin pertama memakai batas bayar order).
            'canBill' => ! $row->isFirst() && $row->status === OrderInstallment::STATUS_SCHEDULED && $inProgress,
            'canChangeDue' => ! $row->isFirst() && $row->isDue() && $inProgress,
            'canRemind' => $row->isDue(),
        ];
    }
}
