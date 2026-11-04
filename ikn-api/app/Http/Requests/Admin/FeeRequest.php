<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\Fee;
use App\Models\User;
use App\Support\I18n;
use App\Support\Money;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST/PUT /admin/fees (kontrak 11.5). amount dalam satuan terkecil mata uang fee (IDR rupiah, USD sen; ASUMSI A-86).
class FeeRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('currency'))) {
            $this->merge(['currency' => strtoupper(trim($this->input('currency')))]);
        }
    }

    public function rules(): array
    {
        return array_merge([
            'type' => ['nullable', Rule::in(Fee::TYPES)],
            'amount' => ['required', 'integer', 'min:0', 'max:9999999999999'],
            'currency' => ['nullable', 'string', Rule::in(Money::CURRENCIES)],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:100000'],
            // Sasaran: all = setiap order; customers = hanya order customerIds[] (wajib minimal satu).
            'audience' => ['nullable', Rule::in(Fee::AUDIENCES)],
            'customerIds' => [Rule::requiredIf($this->input('audience') === Fee::AUDIENCE_CUSTOMERS), 'array', 'max:500'],
            'customerIds.*' => ['integer', Rule::exists('users', 'id')->where('role', User::ROLE_CUSTOMER)],
        ], I18n::rules('name', true, 160));
    }
}
