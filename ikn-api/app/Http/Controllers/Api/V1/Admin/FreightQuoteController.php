<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\ExtendFreightQuoteRequest;
use App\Http\Requests\Admin\FreightQuoteRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Services\Commerce\FreightQuoteService;

/**
 * Penawaran ongkir CIF sisi admin (kontrak 11.12, ASUMSI A-89), modul `orders`, dicatat middleware audit.
 * Semua aksi mengembalikan Order lengkap agar FE menyegarkan kartu penawaran dan status.
 */
class FreightQuoteController extends ApiController
{
    /** Penawaran baru dengan rincian baris; penawaran terbuka sebelumnya menjadi superseded. */
    public function store(FreightQuoteRequest $request, Order $order, FreightQuoteService $quotes)
    {
        $quotes->adminPropose($order, $request->user(), $request->lines(), $request->validUntil(), $request->validated()['note'] ?? null);

        return $this->created(new OrderResource($order->fresh()));
    }

    /** Perpanjang masa berlaku penawaran admin (juga menghidupkan kembali yang expired). */
    public function extend(ExtendFreightQuoteRequest $request, Order $order, OrderFreightQuote $quote, FreightQuoteService $quotes)
    {
        $quotes->adminExtend($order, $quote, $request->validUntil(), $request->user());

        return $this->data(new OrderResource($order->fresh()));
    }

    /** Terima harga balasan customer: efek sama dengan customer menerima penawaran (payment + pending_payment). */
    public function accept(Order $order, OrderFreightQuote $quote, FreightQuoteService $quotes)
    {
        $quotes->adminAcceptCounter($order, $quote, request()->user());

        return $this->data(new OrderResource($order->fresh()));
    }
}
