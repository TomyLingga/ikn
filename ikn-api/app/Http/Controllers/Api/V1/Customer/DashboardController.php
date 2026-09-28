<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\OrderSummaryResource;
use App\Models\Order;
use App\Support\Money;
use Illuminate\Http\Request;

// GET /customer/dashboard: statistik (kompatibel CustomerDashboardStats FE) + 5 order terakhir + status akun.
class DashboardController extends ApiController
{
    public function show(Request $request)
    {
        $user = $request->user();
        $base = Order::ownedBy($user);

        $recent = (clone $base)->with(OrderSummaryResource::eager())->orderByDesc('created_at')->orderByDesc('id')->limit(5)->get();

        return $this->data([
            'totalOrders' => (clone $base)->count(),
            'awaitingPayment' => (clone $base)->whereIn('status', Order::AWAITING_PAYMENT_STATUSES)->count(),
            'inProgress' => (clone $base)->whereIn('status', [Order::STATUS_PAID, Order::STATUS_PROCESSING, Order::STATUS_SHIPPED, Order::STATUS_DELIVERED])->count(),
            'completed' => (clone $base)->where('status', Order::STATUS_COMPLETED)->count(),
            'transactionValue' => Money::toInt((clone $base)->revenue()->sum('grand_total')),
            'recentOrders' => OrderSummaryResource::collection($recent)->resolve(),
            'account' => [
                'status' => $user->status,
                'rejectionReason' => $user->rejection_reason,
                'canOrder' => $user->isActive(),
            ],
        ]);
    }
}
