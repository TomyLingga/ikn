<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\CancelOrderRequest;
use App\Http\Requests\Customer\CheckoutRequest;
use App\Http\Requests\Customer\StoreReviewsRequest;
use App\Http\Resources\OrderResource;
use App\Http\Resources\OrderSummaryResource;
use App\Http\Resources\ReviewResource;
use App\Models\Order;
use App\Models\Review;
use App\Services\Commerce\CheckoutService;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

// Order customer (kontrak bagian 9): daftar, checkout, detail, cancel, konfirmasi diterima/selesai, ulasan.
class OrderController extends ApiController
{
    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', 'string', Rule::in(Order::STATUSES)]]);

        $query = Order::ownedBy($request->user())->with(OrderSummaryResource::eager())
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('created_at')->orderByDesc('id');

        return $this->paginated($query->paginate($this->perPage()), OrderSummaryResource::class);
    }

    /** Checkout: 201 order baru, atau 200 order yang sama bila Idempotency-Key sudah dipakai (24 jam). */
    public function store(CheckoutRequest $request, CheckoutService $checkout)
    {
        $order = $checkout->place($request->user(), $request->validated(), $request->idempotencyKey());

        return $this->data(new OrderResource($order), $checkout->lastWasReplay() ? 200 : 201);
    }

    public function show(Request $request, Order $order)
    {
        return $this->data(new OrderResource($this->own($request, $order)));
    }

    /** Hanya pending_payment; selain itu 409 INVALID_TRANSITION (state machine). */
    public function cancel(CancelOrderRequest $request, Order $order, OrderStateMachine $stateMachine)
    {
        $order = $this->own($request, $order);
        if ($order->status !== Order::STATUS_PENDING_PAYMENT) {
            throw ApiException::conflict('INVALID_TRANSITION', __('commerce.invalid_transition', ['from' => $order->status, 'to' => Order::STATUS_CANCELLED]), [
                'from' => $order->status,
                'to' => Order::STATUS_CANCELLED,
            ]);
        }

        $stateMachine->transition($order, Order::STATUS_CANCELLED, $request->user(), ['reason' => $request->input('reason')]);

        return $this->data(new OrderResource($order->fresh()));
    }

    public function confirmReceived(Request $request, Order $order, OrderStateMachine $stateMachine)
    {
        $order = $this->own($request, $order);
        $stateMachine->transition($order, Order::STATUS_DELIVERED, $request->user());

        return $this->data(new OrderResource($order->fresh()));
    }

    public function complete(Request $request, Order $order, OrderStateMachine $stateMachine)
    {
        $order = $this->own($request, $order);
        $stateMachine->transition($order, Order::STATUS_COMPLETED, $request->user());

        return $this->data(new OrderResource($order->fresh()));
    }

    /** Ulasan hanya order completed, satu per produk per order (ASUMSI A-13); ditulis ke reviews (BE-2) dengan order_id. */
    public function reviews(StoreReviewsRequest $request, Order $order)
    {
        $order = $this->own($request, $order);
        if ($order->status !== Order::STATUS_COMPLETED) {
            throw ApiException::conflict('INVALID_TRANSITION', __('commerce.review_not_completed'), ['from' => $order->status, 'to' => Order::STATUS_COMPLETED]);
        }

        $order->load(['items', 'reviews']);
        $productsBySlug = [];
        foreach ($order->items as $item) {
            $productsBySlug[(string) $item->productSlug()] = (int) $item->product_id;
        }
        $reviewed = $order->reviewedProductIds();

        $errors = [];
        $rows = [];
        foreach ($request->reviews() as $i => $review) {
            $slug = $review['productSlug'];
            if (! isset($productsBySlug[$slug])) {
                $errors["reviews.$i.productSlug"] = [__('commerce.review_product_not_in_order')];
                continue;
            }
            $productId = $productsBySlug[$slug];
            if (in_array($productId, $reviewed, true) || isset($rows[$productId])) {
                $errors["reviews.$i.productSlug"] = [__('commerce.review_duplicate')];
                continue;
            }
            $rows[$productId] = ['rating' => (int) $review['rating'], 'body' => $review['body'] ?? null];
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        $created = DB::transaction(function () use ($order, $rows, $request) {
            $out = [];
            foreach ($rows as $productId => $row) {
                $out[] = Review::create([
                    'product_id' => $productId,
                    'user_id' => $request->user()->id,
                    'order_id' => $order->id,
                    'rating' => $row['rating'],
                    'body' => $row['body'],
                    'is_published' => true,
                ]);
            }

            return $out;
        });

        $order = $order->fresh(['items', 'reviews']);

        return $this->created([
            'reviews' => ReviewResource::collection(collect($created)->map->load(['product', 'user']))->resolve(),
            'order' => ['number' => $order->number, 'canReview' => $order->canReview()],
        ]);
    }

    /** Order milik customer; bukan miliknya → 404 NOT_FOUND (kontrak bagian 2). */
    private function own(Request $request, Order $order): Order
    {
        if (! $request->user()->can('act', $order)) {
            throw ApiException::notFound();
        }

        return $order;
    }
}
