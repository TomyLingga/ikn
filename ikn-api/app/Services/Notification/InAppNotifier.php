<?php

namespace App\Services\Notification;

use App\Models\Order;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Satu pintu notifikasi dalam aplikasi (lonceng portal customer, ASUMSI A-71).
 * Judul dan isi dirender dua bahasa dari resources/lang/{id,en}/notifications.php saat dibuat, sehingga
 * riwayat tidak berubah ketika teks diperbarui. Kegagalan menulis tidak boleh menggagalkan aksi pemanggil.
 */
class InAppNotifier
{
    /**
     * @param  int|User  $user
     * @param  string  $type  kunci di notifications.php, mis. "order.shipped"
     * @param  array  $params  parameter pengganti (:number, :reason, ...)
     */
    public function notify($user, string $type, array $params = [], ?string $url = null, array $data = []): ?UserNotification
    {
        $userId = $user instanceof User ? $user->id : (int) $user;
        if ($userId <= 0) {
            return null;
        }

        try {
            return UserNotification::create([
                'user_id' => $userId,
                'type' => $type,
                'title' => $this->render($type.'.title', $params),
                'body' => $this->render($type.'.body', $params),
                'url' => $url,
                'data' => $data ?: null,
            ]);
        } catch (Throwable $e) {
            Log::warning('in-app notification failed: '.$e->getMessage(), ['type' => $type, 'user' => $userId]);

            return null;
        }
    }

    /** Notifikasi terkait order: penerima = pemilik order, tautan ke detail pesanan di portal. */
    public function order(Order $order, string $type, array $params = []): ?UserNotification
    {
        if (! $order->user_id) {
            return null;
        }

        return $this->notify(
            (int) $order->user_id,
            $type,
            ['number' => $order->number] + $params,
            '/dashboard/pesanan/'.$order->number,
            ['orderNumber' => $order->number]
        );
    }

    public function unreadCount(User $user): int
    {
        return UserNotification::where('user_id', $user->id)->unread()->count();
    }

    /** @return array{id:string,en:string} */
    private function render(string $key, array $params): array
    {
        $out = [];
        foreach (User::LOCALES as $locale) {
            $out[$locale] = (string) __('notifications.'.$key, $params, $locale);
        }

        return $out;
    }
}
