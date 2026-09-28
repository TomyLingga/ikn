<?php

namespace App\Services\Commerce;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

/**
 * Ambil alamat milik user untuk quote/checkout tanpa bergantung statis pada App\Models\CustomerAddress (area BE-1):
 * model dipakai bila kelasnya ada; bila hanya tabelnya yang ada, baris dibaca sebagai array (duck typing di calculator).
 */
class AddressResolver
{
    public const MODEL = 'App\\Models\\CustomerAddress';

    /**
     * @return object|array
     *
     * @throws ValidationException addressId tidak ditemukan / fitur alamat belum tersedia
     */
    public function forUser(User $user, int $addressId)
    {
        if (class_exists(self::MODEL)) {
            $model = self::MODEL;
            $address = $model::query()->where('user_id', $user->id)->whereKey($addressId)->first();
            if (! $address) {
                throw ValidationException::withMessages(['addressId' => [__('catalog.quote.address_not_found')]]);
            }

            return $address;
        }

        if (Schema::hasTable('customer_addresses')) {
            $row = DB::table('customer_addresses')->where('user_id', $user->id)->where('id', $addressId)->first();
            if (! $row) {
                throw ValidationException::withMessages(['addressId' => [__('catalog.quote.address_not_found')]]);
            }

            return (array) $row;
        }

        throw ValidationException::withMessages(['addressId' => [__('catalog.quote.address_unavailable')]]);
    }
}
