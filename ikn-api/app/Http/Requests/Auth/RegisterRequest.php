<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\Account\AccountFormRequest;

// POST /auth/register (kontrak bagian 3).
class RegisterRequest extends AccountFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeEmail();
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:190', 'unique:users,email'],
            'password' => $this->passwordRules(),
            'passwordConfirmation' => ['required', 'string'],
            'phone' => ['nullable', 'string', 'max:40', new \App\Rules\PhoneNumber()],
            'company' => ['nullable', 'string', 'max:160'],
            'position' => ['nullable', 'string', 'max:120'],
            'taxId' => ['nullable', 'string', 'max:40'],
        ];
    }

    public function messages(): array
    {
        return $this->passwordMessages();
    }
}
