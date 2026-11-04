<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Account\AccountFormRequest;
use App\Models\CustomerProfile;
use Illuminate\Validation\Rule;

// PUT /admin/customers/{customer}/market: { market: local|export } (kontrak 11.9, ASUMSI A-86).
// Ditolak 409 CUSTOMER_HAS_OPEN_ORDERS oleh CustomerMarketService bila customer masih punya order berjalan.
class UpdateCustomerMarketRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'market' => ['required', 'string', Rule::in(CustomerProfile::MARKETS)],
        ];
    }
}
