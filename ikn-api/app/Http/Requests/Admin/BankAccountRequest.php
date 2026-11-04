<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Support\Money;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST/PUT /admin/bank-accounts (kontrak 11.5). Rekening USD (ASUMSI A-86) membawa SWIFT, alamat bank, bank koresponden.
class BankAccountRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        if (is_string($this->input('currency'))) {
            $merge['currency'] = strtoupper(trim($this->input('currency')));
        }
        if (is_string($this->input('swiftCode'))) {
            $merge['swiftCode'] = strtoupper(preg_replace('/\s+/', '', $this->input('swiftCode')));
        }
        if ($merge !== []) {
            $this->merge($merge);
        }
    }

    public function rules(): array
    {
        return [
            'bankName' => ['required', 'string', 'max:120'],
            'accountNumber' => ['required', 'string', 'max:64'],
            'accountHolder' => ['required', 'string', 'max:160'],
            'currency' => ['nullable', 'string', Rule::in(Money::CURRENCIES)],
            'swiftCode' => ['nullable', 'string', 'max:16', 'regex:/^[A-Z0-9]{8}([A-Z0-9]{3})?$/'],
            'bankAddress' => ['nullable', 'string', 'max:255'],
            'correspondentBank' => ['nullable', 'string', 'max:160'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ];
    }

    public function messages(): array
    {
        return ['swiftCode.regex' => __('catalog.swift_code_invalid')];
    }
}
