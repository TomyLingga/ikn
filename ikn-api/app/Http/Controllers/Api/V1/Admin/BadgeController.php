<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Auth\ModuleAccess;
use App\Services\Chat\ChatService;
use Illuminate\Http\Request;

// GET /admin/badges: penghitung untuk badge sidebar admin dalam satu panggilan. Nilai null = admin tidak
// punya modulnya (badge tidak ditampilkan). orders = order sudah dibayar yang masih berjalan (dibayar, diproses,
// dikirim, diterima); verifikasi pembayaran dihitung di badge payments agar tidak ganda.

class BadgeController extends ApiController
{
    public const ORDER_WORK_STATUSES = [Order::STATUS_PAID, Order::STATUS_PROCESSING, Order::STATUS_SHIPPED, Order::STATUS_DELIVERED];

    public function show(Request $request, ModuleAccess $access, ChatService $chat)
    {
        $user = $request->user();

        return $this->data([
            'orders' => $access->allows($user, 'orders')
                ? Order::whereIn('status', self::ORDER_WORK_STATUSES)->count()
                : null,
            'payments' => $access->allows($user, 'payments')
                ? Payment::where('status', Payment::STATUS_AWAITING_VERIFICATION)->count()
                : null,
            'customers' => $access->allows($user, 'customers')
                ? User::customers()->where('status', User::STATUS_PENDING)->count()
                : null,
            'chat' => $access->allows($user, 'chat') ? $chat->adminUnreadConversations() : null,
        ]);
    }
}
