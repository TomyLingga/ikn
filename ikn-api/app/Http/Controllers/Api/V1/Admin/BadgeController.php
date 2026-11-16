<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Auth\ModuleAccess;
use App\Services\Chat\ChatService;
use App\Services\Notification\InAppNotifier;
use Illuminate\Http\Request;

// GET /admin/badges: penghitung untuk badge sidebar admin dalam satu panggilan. Nilai null = admin tidak
// punya modulnya (badge tidak ditampilkan). orders = order yang menunggu tindakan admin modul orders: permintaan
// penawaran ongkir CIF (awaiting_freight, A-89) dan order sudah dibayar yang masih berjalan (dibayar, diproses,
// dikirim, diterima); verifikasi pembayaran dihitung di badge payments agar tidak ganda. notifications = lonceng
// top bar (notifikasi admin ini yang belum dibaca), selalu angka.

class BadgeController extends ApiController
{
    public const ORDER_WORK_STATUSES = [Order::STATUS_AWAITING_FREIGHT, Order::STATUS_PAID, Order::STATUS_PROCESSING, Order::STATUS_SHIPPED, Order::STATUS_DELIVERED];

    public function show(Request $request, ModuleAccess $access, ChatService $chat, InAppNotifier $notifier)
    {
        $user = $request->user();

        return $this->data([
            // Lonceng top bar: notifikasi milik admin ini yang belum dibaca (tidak bergantung modul).
            'notifications' => $notifier->unreadCount($user),
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
