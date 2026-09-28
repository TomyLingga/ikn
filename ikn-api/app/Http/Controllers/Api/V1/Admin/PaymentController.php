<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\RejectPaymentRequest;
use App\Http\Resources\AdminPaymentResource;
use App\Models\Order;
use App\Models\Payment;
use App\Services\Payment\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

// Admin pembayaran (kontrak 11.2), modul `payments`: daftar per payment + order ringkas, accept/reject, alias by nomor order.
class PaymentController extends ApiController
{
    /** Default status awaiting_verification; `status=all` untuk semua. q: nomor order, nama/perusahaan/email customer. */
    public function index(Request $request)
    {
        $request->validate([
            'status' => ['nullable', 'string', Rule::in(array_merge(Payment::STATUSES, ['all']))],
            'method' => ['nullable', 'string', 'max:64'],
            'q' => ['nullable', 'string', 'max:120'],
        ]);
        $status = $request->query('status', Payment::STATUS_AWAITING_VERIFICATION);

        $query = Payment::with(AdminPaymentResource::eager())
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->when($request->query('method'), fn ($q, $method) => $q->where('method', strtolower(trim($method))))
            ->when(trim((string) $request->query('q')), function ($q, $term) {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $q->where(function ($w) use ($like) {
                    $w->where('external_id', 'ILIKE', $like)
                        ->orWhereHas('order', function ($o) use ($like) {
                            $o->where('number', 'ILIKE', $like)
                                ->orWhere('invoice_number', 'ILIKE', $like)
                                ->orWhereRaw("customer_snapshot->>'name' ILIKE ?", [$like])
                                ->orWhereRaw("customer_snapshot->>'company' ILIKE ?", [$like])
                                ->orWhereRaw("customer_snapshot->>'email' ILIKE ?", [$like]);
                        });
                });
            })
            ->orderByRaw("CASE status WHEN 'awaiting_verification' THEN 0 ELSE 1 END")
            ->orderByDesc('proof_uploaded_at')->orderByDesc('id');

        return $this->paginated($query->paginate($this->perPage()), AdminPaymentResource::class);
    }

    public function show(Payment $payment)
    {
        return $this->data(new AdminPaymentResource($payment->load(AdminPaymentResource::eager())));
    }

    public function accept(Request $request, Payment $payment, PaymentService $payments)
    {
        return $this->verified($payments->accept($payment, $request->user()));
    }

    public function reject(RejectPaymentRequest $request, Payment $payment, PaymentService $payments)
    {
        return $this->verified($payments->reject($payment, $request->user(), $request->validated()['reason']));
    }

    /** Alias kompatibilitas FE: accept payment aktif (awaiting_verification) dari nomor order. */
    public function acceptByOrder(Request $request, Order $order, PaymentService $payments)
    {
        return $this->verified($payments->accept($this->awaiting($order), $request->user()));
    }

    public function rejectByOrder(RejectPaymentRequest $request, Order $order, PaymentService $payments)
    {
        return $this->verified($payments->reject($this->awaiting($order), $request->user(), $request->validated()['reason']));
    }

    private function awaiting(Order $order): Payment
    {
        $payment = Payment::where('order_id', $order->id)->where('status', Payment::STATUS_AWAITING_VERIFICATION)->orderByDesc('id')->first();
        if (! $payment) {
            throw ApiException::conflict('INVALID_TRANSITION', __('commerce.payment_invalid_status', ['status' => $order->payment_status ?? '-']), [
                'from' => $order->status,
                'to' => Order::STATUS_PAID,
            ]);
        }

        return $payment;
    }

    /** Respons kontrak 11.2: { payment, order }. */
    private function verified(Payment $payment)
    {
        $payment->load(AdminPaymentResource::eager());
        $resource = (new AdminPaymentResource($payment))->resolve();
        $order = $resource['order'];
        unset($resource['order']);

        return $this->data(['payment' => $resource, 'order' => $order]);
    }
}
