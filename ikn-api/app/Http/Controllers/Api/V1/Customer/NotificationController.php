<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\UserNotificationResource;
use App\Models\ChatConversation;
use App\Models\UserNotification;
use App\Services\Notification\InAppNotifier;
use Illuminate\Http\Request;

// Lonceng notifikasi portal customer (ASUMSI A-71): daftar, penghitung badge, tandai dibaca.
class NotificationController extends ApiController
{
    public function index(Request $request, InAppNotifier $notifier)
    {
        $request->validate(['unread' => ['nullable', 'boolean']]);
        $user = $request->user();

        $query = UserNotification::where('user_id', $user->id)
            ->when($request->boolean('unread'), fn ($q) => $q->unread())
            ->orderByDesc('created_at')->orderByDesc('id');

        $paginator = $query->paginate($this->perPage(15, 50));

        return response()->json([
            'data' => UserNotificationResource::collection(collect($paginator->items())),
            'meta' => [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
                'unread' => $notifier->unreadCount($user),
            ],
        ]);
    }

    /** Penghitung untuk badge top bar portal: notifikasi belum dibaca + pesan chat admin yang belum dibaca. */
    public function badges(Request $request, InAppNotifier $notifier)
    {
        $user = $request->user();

        return $this->data([
            'notifications' => $notifier->unreadCount($user),
            'chat' => (int) ChatConversation::where('user_id', $user->id)->value('customer_unread'),
        ]);
    }

    public function read(Request $request, int $id, InAppNotifier $notifier)
    {
        $notification = UserNotification::where('user_id', $request->user()->id)->whereKey($id)->first();
        if (! $notification) {
            throw ApiException::notFound();
        }
        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return $this->data((new UserNotificationResource($notification))->resolve(), 200, [
            'meta' => ['unread' => $notifier->unreadCount($request->user())],
        ]);
    }

    public function readAll(Request $request)
    {
        $updated = UserNotification::where('user_id', $request->user()->id)->unread()->update(['read_at' => now()]);

        return $this->data(['updated' => $updated, 'unread' => 0]);
    }
}
