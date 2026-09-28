<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Account\AccountFormRequest;

// PUT /customer/profile/password: currentPassword, password, passwordConfirmation.
class UpdatePasswordRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'currentPassword' => ['required', 'string', 'max:200'],
            'password' => array_merge($this->passwordRules(), ['different:currentPassword']),
            'passwordConfirmation' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return $this->passwordMessages();
    }
}
