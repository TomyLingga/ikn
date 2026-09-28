<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Customer\CreatePaymentRequest;
use App\Http\Requests\Customer\UploadProofRequest;
use App\Http\Resources\OrderResource;
use App\Http\Resources\PaymentResource;
use App\Models\Order;
use App\Services\Payment\PaymentService;
use Illuminate\Http\Request;

// Pembayaran order customer (kontrak bagian 9–10): histori payment, ganti metode, unggah bukti.
class OrderPaymentController extends ApiController
{
    public function index(Request $request, Order $order)
    {
        $order = $this->own($request, $order);

        return $this->data(PaymentResource::collection($order->payments()->with(PaymentResource::eager())->get()));
    }

    /** Payment baru dengan metode lain; 409 PAYMENT_ALREADY_ACTIVE bila masih ada yang menunggu verifikasi. */
    public function store(CreatePaymentRequest $request, Order $order, PaymentService $payments)
    {
        $order = $this->own($request, $order);
        $data = $request->validated();

        $payment = $payments->switchMethod($order, $data['paymentMethodCode'], isset($data['bankAccountId']) ? (int) $data['bankAccountId'] : null, $request->user());

        return $this->created([
            'payment' => (new PaymentResource($payment->load(PaymentResource::eager())))->resolve(),
            'order' => (new OrderResource($order->fresh()))->resolve(),
        ]);
    }

    /** Multipart file (+ paymentId?) → payment awaiting_verification, order payment_review (kontrak bagian 9). */
    public function proof(UploadProofRequest $request, Order $order, PaymentService $payments)
    {
        $order = $this->own($request, $order);
        $data = $request->validated();

        $payment = $payments->uploadProof($order, $request->file('file'), isset($data['paymentId']) ? (int) $data['paymentId'] : null, $request->user());
        $order = $order->fresh();

        return $this->data([
            'order' => [
                'number' => $order->number,
                'status' => $order->status,
                'paymentStatus' => $order->payment_status,
            ],
            'payment' => (new PaymentResource($payment->load(PaymentResource::eager())))->resolve(),
        ]);
    }

    private function own(Request $request, Order $order): Order
    {
        if (! $request->user()->can('act', $order)) {
            throw ApiException::notFound();
        }

        return $order;
    }
}
