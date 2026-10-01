<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:190'],
            'password' => ['required', 'string', 'max:200'],
            // "Ingat saya": cookie remember (web guard) agar tetap login setelah sesi/peramban ditutup.
            'remember' => ['sometimes', 'boolean'],
        ];
    }
}
