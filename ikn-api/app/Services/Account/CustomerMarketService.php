<?php

namespace App\Services\Account;

use App\Exceptions\ApiException;
use App\Models\CustomerProfile;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Pasar customer (ASUMSI A-86): local (IDR) atau export (USD). Hanya admin yang mengubahnya, dan hanya bila customer
 * tidak punya order berjalan (semua order sudah completed/cancelled/expired), karena mata uang order mengikuti pasar
 * saat checkout dan laporan dipisah per mata uang.
 */
class CustomerMarketService
{
    /** @throws ApiException 409 CUSTOMER_HAS_OPEN_ORDERS */
    public function change(User $customer, string $market): User
    {
        if (! in_array($market, CustomerProfile::MARKETS, true)) {
            throw new \InvalidArgumentException("Unknown market '{$market}'.");
        }

        // Baris user dikunci (sama dengan CheckoutService::createOrder) lalu order berjalan dicek ulang di bawah kunci,
        // agar checkout bersamaan tidak membuat order bermata uang pasar lama setelah pasar diganti.
        return DB::transaction(function () use ($customer, $market) {
            User::whereKey($customer->id)->lockForUpdate()->first();
            $customer->load('profile');
            $profile = $customer->profile ?? $customer->profile()->create([]);
            if ($profile->marketOrDefault() === $market) {
                $customer->setRelation('profile', $profile);

                return $customer;
            }

            $open = $this->openOrdersCount($customer);
            if ($open > 0) {
                throw ApiException::conflict('CUSTOMER_HAS_OPEN_ORDERS', __('account.market_open_orders', ['count' => $open]), ['openOrders' => $open]);
            }

            $profile->forceFill(['market' => $market])->save();
            $customer->setRelation('profile', $profile);

            return $customer;
        });
    }

    public function openOrdersCount(User $customer): int
    {
        return Order::ownedBy($customer)->whereNotIn('status', Order::FINAL_STATUSES)->count();
    }
}
