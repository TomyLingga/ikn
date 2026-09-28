<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\Account\AccountFormRequest;

// POST /auth/password/reset: { token, email, password, passwordConfirmation }.
class ResetPasswordRequest extends AccountFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeEmail();
    }

    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:200'],
            'email' => ['required', 'string', 'email', 'max:190'],
            'password' => $this->passwordRules(),
            'passwordConfirmation' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return $this->passwordMessages();
    }
}
