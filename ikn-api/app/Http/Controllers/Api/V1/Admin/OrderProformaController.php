<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\ProformaRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\Commerce\ProformaService;

/**
 * Proforma invoice per order (kontrak 11.11, ASUMSI A-88), modul `orders`: PUT membuat revisi 1 atau menaikkan revisi.
 * Mengembalikan Order lengkap agar FE menyegarkan detail dan cetakan proforma.
 */
class OrderProformaController extends ApiController
{
    public function update(ProformaRequest $request, Order $order, ProformaService $proformas)
    {
        $proformas->save($order, $request->proformaData(), $request->user());

        return $this->data(new OrderResource($order->fresh()));
    }
}
