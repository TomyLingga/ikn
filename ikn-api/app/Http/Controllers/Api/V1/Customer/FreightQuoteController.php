<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Customer\CounterFreightQuoteRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Services\Commerce\FreightQuoteService;
use Illuminate\Http\Request;

/**
 * Penawaran ongkir CIF sisi customer (kontrak 11.12, ASUMSI A-89): terima penawaran admin terakhir yang masih berlaku,
 * atau ajukan harga balasan. Order bukan miliknya → 404 (OrderPolicy::act, kontrak bagian 2).
 */
class FreightQuoteController extends ApiController
{
    public function accept(Request $request, Order $order, OrderFreightQuote $quote, FreightQuoteService $quotes)
    {
        $order = $this->own($request, $order);
        $quotes->customerAccept($order, $request->user(), $quote);

        return $this->data(new OrderResource($order->fresh()));
    }

    public function counter(CounterFreightQuoteRequest $request, Order $order, FreightQuoteService $quotes)
    {
        $order = $this->own($request, $order);
        $data = $request->validated();
        $quotes->customerCounter($order, $request->user(), (int) $data['amount'], $data['note'] ?? null);

        return $this->data(new OrderResource($order->fresh()));
    }

    private function own(Request $request, Order $order): Order
    {
        if (! $request->user()->can('act', $order)) {
            throw ApiException::notFound();
        }

        return $order;
    }
}
