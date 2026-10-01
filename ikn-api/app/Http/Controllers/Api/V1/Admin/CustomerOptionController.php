<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Models\User;
use App\Services\Auth\ModuleAccess;
use Illuminate\Http\Request;

// GET /admin/customer-options?q=: daftar ringkas customer untuk pemilih sasaran voucher/biaya tambahan.
// Boleh diakses admin yang punya salah satu modul customers, vouchers, atau fees (tanpa membuka data customer lengkap).
class CustomerOptionController extends ApiController
{
    private const MODULES = ['customers', 'vouchers', 'fees'];

    public function index(Request $request, ModuleAccess $access)
    {
        $user = $request->user();
        $allowed = false;
        foreach (self::MODULES as $module) {
            $allowed = $allowed || $access->allows($user, $module);
        }
        if (! $allowed) {
            throw ApiException::forbidden(__('api.module_forbidden', ['module' => implode('|', self::MODULES)]));
        }

        $request->validate(['q' => ['nullable', 'string', 'max:120']]);

        $query = User::customers()->with('profile')->where('status', User::STATUS_ACTIVE);
        if ($q = trim((string) $request->query('q'))) {
            $like = '%'.addcslashes($q, '%_\\').'%';
            $query->where(function ($w) use ($like) {
                $w->where('name', 'ILIKE', $like)
                    ->orWhere('email', 'ILIKE', $like)
                    ->orWhereHas('profile', fn ($p) => $p->where('company', 'ILIKE', $like));
            });
        }

        return $this->data($query->orderBy('name')->limit(20)->get()->map(fn (User $customer) => [
            'id' => $customer->id,
            'name' => $customer->name,
            'company' => $customer->profile?->company,
            'email' => $customer->email,
        ])->all());
    }
}
