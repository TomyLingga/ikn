<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Account\AccountFormRequest;
use App\Models\Region;

// POST/PUT /customer/addresses (skema kontrak bagian 4). Rantai wilayah divalidasi AddressService (422).
class AddressRequest extends AccountFormRequest
{
    public function rules(): array
    {
        $code = ['required', 'string', 'max:16', 'regex:'.Region::CODE_PATTERN];

        return [
            'label' => ['required', 'string', 'max:80'],
            'recipientName' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:40'],
            'addressLine' => ['required', 'string', 'max:1000'],
            'provinceCode' => $code,
            'regencyCode' => $code,
            'districtCode' => $code,
            'villageCode' => $code,
            'postalCode' => ['nullable', 'string', 'max:10'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'note' => ['nullable', 'string', 'max:500'],
            'isDefault' => ['nullable', 'boolean'],
        ];
    }
}
