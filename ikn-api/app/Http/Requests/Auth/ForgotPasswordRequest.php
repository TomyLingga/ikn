<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\Account\AccountFormRequest;

// POST /auth/password/forgot.
class ForgotPasswordRequest extends AccountFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeEmail();
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:190'],
        ];
    }
}
