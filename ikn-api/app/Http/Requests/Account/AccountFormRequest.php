<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

// Dasar Form Request area akun: input camelCase, nama atribut dari resources/lang/*/account.php (kunci attributes),
// kebijakan password bersama (ASUMSI A-25, diperketat A-78: min 8 karakter, huruf besar, huruf kecil, dan angka).
abstract class AccountFormRequest extends FormRequest
{
    public const PASSWORD_PATTERN = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/';

    public function authorize(): bool
    {
        return true;
    }

    public function attributes(): array
    {
        $attributes = __('account.attributes');

        return is_array($attributes) ? $attributes : [];
    }

    /** @return array<int, string> */
    protected function passwordRules(): array
    {
        return ['required', 'string', 'min:8', 'max:200', 'regex:'.self::PASSWORD_PATTERN, 'same:passwordConfirmation'];
    }

    /** @return array<string, string> */
    protected function passwordMessages(string $field = 'password'): array
    {
        return [
            $field.'.min' => __('account.password_policy'),
            $field.'.regex' => __('account.password_policy'),
            $field.'.same' => __('account.password_mismatch'),
        ];
    }

    protected function normalizeEmail(string $field = 'email'): void
    {
        if ($this->has($field) && is_string($this->input($field))) {
            $this->merge([$field => strtolower(trim((string) $this->input($field)))]);
        }
    }
}
