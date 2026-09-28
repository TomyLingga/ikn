<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\CancelOrderRequest;
use App\Http\Requests\Admin\UpdateOrderDueRequest;
use App\Http\Requests\Admin\UpdateOrderStatusRequest;
use App\Http\Resources\OrderResource;
use App\Http\Resources\OrderSummaryResource;
use App\Models\Order;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Payment\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

// Admin order (kontrak 11.2), modul `orders`. Aksi tulis dicatat middleware audit; transisi lewat OrderStateMachine.
class OrderController extends ApiController
{
    public function index(Request $request)
    {
        $request->validate([
            'status' => ['nullable', 'string', Rule::in(array_merge(Order::STATUSES, ['all']))],
            'paymentStatus' => ['nullable', 'string'],
            'q' => ['nullable', 'string', 'max:120'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $tz = config('app.timezone');

        $query = Order::with(OrderSummaryResource::eager())
            ->when($request->query('status') && $request->query('status') !== 'all', fn ($q) => $q->where('status', $request->query('status')))
            ->when($request->query('paymentStatus'), fn ($q, $s) => $q->where('payment_status', $s))
            ->when($request->query('from'), fn ($q, $from) => $q->where('created_at', '>=', Carbon::parse($from, $tz)->startOfDay()))
            ->when($request->query('to'), fn ($q, $to) => $q->where('created_at', '<=', Carbon::parse($to, $tz)->endOfDay()))
            ->when(trim((string) $request->query('q')), function ($q, $term) {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $q->where(function ($w) use ($like) {
                    $w->where('number', 'ILIKE', $like)
                        ->orWhere('invoice_number', 'ILIKE', $like)
                        ->orWhereRaw("customer_snapshot->>'name' ILIKE ?", [$like])
                        ->orWhereRaw("customer_snapshot->>'company' ILIKE ?", [$like])
                        ->orWhereRaw("customer_snapshot->>'pic' ILIKE ?", [$like])
                        ->orWhereRaw("customer_snapshot->>'email' ILIKE ?", [$like]);
                });
            })
            ->orderByDesc('created_at')->orderByDesc('id');

        return $this->paginated($query->paginate($this->perPage()), OrderSummaryResource::class);
    }

    public function show(Order $order)
    {
        return $this->data(new OrderResource($order));
    }

    /** processing|shipped|delivered|completed; shipped wajib kurir + resi (422). Transisi tidak sah → 409. */
    public function updateStatus(UpdateOrderStatusRequest $request, Order $order, OrderStateMachine $stateMachine)
    {
        $data = $request->validated();
        $stateMachine->transition($order, $data['status'], $request->user(), [
            'note' => $data['note'] ?? null,
            'courier' => $data['courier'] ?? null,
            'trackingNumber' => $data['trackingNumber'] ?? null,
        ]);

        return $this->data(new OrderResource($order->fresh()));
    }

    /** Batal oleh admin (alasan wajib): release bila belum bayar, adjust +stok bila sudah paid/processing. */
    public function cancel(CancelOrderRequest $request, Order $order, OrderStateMachine $stateMachine)
    {
        $stateMachine->transition($order, Order::STATUS_CANCELLED, $request->user(), ['reason' => $request->validated()['reason'] ?? null]);

        return $this->data(new OrderResource($order->fresh()));
    }

    /** { paymentDueAt } atau { extendHours }: hanya pending_payment/payment_review; expires_at payment aktif ikut. */
    public function updateDue(UpdateOrderDueRequest $request, Order $order, PaymentService $payments)
    {
        $payments->updateDue($order, $request->resolveDue($order->payment_due_at), $request->user());

        return $this->data(new OrderResource($order->fresh()));
    }
}
