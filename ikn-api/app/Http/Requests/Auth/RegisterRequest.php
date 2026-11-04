<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\Account\AccountFormRequest;
use App\Support\Countries;
use Illuminate\Validation\Rule;

// POST /auth/register (kontrak bagian 3). countryCode (ISO 3166-1 alpha-2, bawaan ID) dan companyAddress dipakai
// admin saat menentukan pasar (ASUMSI A-86); pasar itu sendiri tidak pernah dipilih customer.
class RegisterRequest extends AccountFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeEmail();
        if (is_string($this->input('countryCode'))) {
            $this->merge(['countryCode' => Countries::normalize($this->input('countryCode'))]);
        }
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
            'countryCode' => ['nullable', 'string', 'size:2', Rule::in(Countries::codes())],
            'companyAddress' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return $this->passwordMessages();
    }
}
