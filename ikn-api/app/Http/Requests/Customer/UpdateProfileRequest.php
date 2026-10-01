<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Account\AccountFormRequest;

// PUT /customer/profile: name, phone, position.
class UpdateProfileRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40', new \App\Rules\PhoneNumber()],
            'position' => ['sometimes', 'nullable', 'string', 'max:120'],
        ];
    }
}
