<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\Fee;
use App\Models\User;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FeeRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'type' => ['nullable', Rule::in(Fee::TYPES)],
            'amount' => ['required', 'integer', 'min:0', 'max:9999999999999'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:100000'],
            // Sasaran: all = setiap order; customers = hanya order customerIds[] (wajib minimal satu).
            'audience' => ['nullable', Rule::in(Fee::AUDIENCES)],
            'customerIds' => [Rule::requiredIf($this->input('audience') === Fee::AUDIENCE_CUSTOMERS), 'array', 'max:500'],
            'customerIds.*' => ['integer', Rule::exists('users', 'id')->where('role', User::ROLE_CUSTOMER)],
        ], I18n::rules('name', true, 160));
    }
}
