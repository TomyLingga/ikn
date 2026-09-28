<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;

// Alias `customer.active`: hanya customer berstatus active (sudah disetujui admin) yang boleh
// checkout dan aksi transaksi lain (KEPUTUSAN registrasi → approve; ASUMSI A-12: login tetap boleh).
class EnsureCustomerActive
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user || ! $user->isCustomer()) {
            throw new ApiException(403, 'FORBIDDEN', __('api.forbidden'));
        }

        if ($user->status !== User::STATUS_ACTIVE) {
            throw new ApiException(403, 'ACCOUNT_NOT_APPROVED', __('api.account_not_approved'), ['status' => $user->status]);
        }

        return $next($request);
    }
}
