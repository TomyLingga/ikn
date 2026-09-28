<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

// Customer hanya order miliknya (controller mengubah penolakan menjadi 404 NOT_FOUND, kontrak bagian 2); admin aktif boleh semua.
class OrderPolicy
{
    use HandlesAuthorization;

    public function view(User $user, Order $order): bool
    {
        if ($user->isAdmin()) {
            return $user->isActive();
        }

        return $user->isCustomer() && (int) $order->user_id === (int) $user->id;
    }

    /** Aksi customer pada order miliknya (cancel, proof, confirm-received, complete, reviews, payments). */
    public function act(User $user, Order $order): bool
    {
        return $user->isCustomer() && (int) $order->user_id === (int) $user->id;
    }
}
