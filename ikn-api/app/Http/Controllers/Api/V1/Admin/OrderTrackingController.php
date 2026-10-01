<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\StoreOrderTrackingRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\OrderTrackingUpdate;
use App\Services\Commerce\OrderNotifier;

/**
 * Catatan perjalanan kiriman (ASUMSI A-70), modul `orders`: admin menambah keterangan bebas di antara
 * "Dikirim" dan "Diterima" (mis. "Tiba di gudang transit Pekanbaru"). Status order tidak berubah,
 * jadi tidak lewat OrderStateMachine; hanya boleh selama order berstatus shipped.
 */
class OrderTrackingController extends ApiController
{
    public function store(StoreOrderTrackingRequest $request, Order $order, OrderNotifier $notifier)
    {
        $this->assertShipped($order);

        $update = $order->trackingUpdates()->create([
            'note' => $request->validated()['note'],
            'created_by' => $request->user()->id,
        ]);
        $notifier->trackingUpdated($order, $update);

        return $this->created(new OrderResource($order->fresh()));
    }

    public function destroy(Order $order, OrderTrackingUpdate $update)
    {
        if ((int) $update->order_id !== (int) $order->id) {
            throw ApiException::notFound();
        }
        $this->assertShipped($order);
        $update->delete();

        return $this->data(new OrderResource($order->fresh()));
    }

    private function assertShipped(Order $order): void
    {
        if (! $order->canAddTracking()) {
            throw ApiException::conflict('TRACKING_NOT_ALLOWED', __('notifications.tracking_not_allowed'), ['status' => $order->status]);
        }
    }
}
