<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\BillInstallmentRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\OrderInstallment;
use App\Services\Commerce\InstallmentService;
use Illuminate\Http\Request;

/**
 * Termin pembayaran sisi admin (kontrak 11.13, ASUMSI A-97), modul `payments` seperti verifikasi pembayaran, dicatat
 * middleware audit. Verifikasi bukti termin tetap lewat POST /admin/payments/{id}/accept|reject.
 * Semua aksi mengembalikan Order lengkap agar FE menyegarkan kartu "Jadwal pembayaran".
 */
class OrderInstallmentController extends ApiController
{
    /** Tagih termin lebih awal, atau ubah tanggal jatuh tempo termin yang sudah ditagih (dueAt wajib). */
    public function bill(BillInstallmentRequest $request, Order $order, OrderInstallment $installment, InstallmentService $installments)
    {
        $installments->bill($order, $installment, $request->dueAt(), $request->user());

        return $this->data(new OrderResource($order->fresh()));
    }

    /** Kirim pengingat pembayaran (email + notifikasi); 409 INSTALLMENT_REMINDER_TOO_SOON bila baru saja dikirim. */
    public function remind(Request $request, Order $order, OrderInstallment $installment, InstallmentService $installments)
    {
        $installments->remind($order, $installment, $request->user());

        return $this->data(new OrderResource($order->fresh()));
    }
}
