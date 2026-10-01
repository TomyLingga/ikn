<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VoucherRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtoupper(trim($this->input('code')))]);
        }
    }

    public function rules(): array
    {
        $voucher = $this->route('voucher');

        return [
            'code' => ['required', 'string', 'max:64', 'regex:/^[A-Z0-9_-]+$/', Rule::unique('vouchers', 'code')->ignore($voucher?->id)],
            'type' => ['required', Rule::in(Voucher::TYPES)],
            'value' => ['required', 'numeric', 'min:0', 'max:9999999999999', $this->input('type') === Voucher::TYPE_PERCENT ? 'max:100' : 'integer'],
            'minSubtotal' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'maxDiscount' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'quota' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'perUserLimit' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'scope' => ['nullable', Rule::in(Voucher::SCOPES)],
            'categoryIds' => ['nullable', 'array', 'max:200'],
            'categoryIds.*' => ['integer', 'exists:categories,id'],
            'startsAt' => ['nullable', 'date'],
            'endsAt' => ['nullable', 'date', 'after_or_equal:startsAt'],
            'isActive' => ['nullable', 'boolean'],
            // Sasaran: all = semua customer; customers = hanya customerIds[] (wajib minimal satu).
            'audience' => ['nullable', Rule::in(Voucher::AUDIENCES)],
            'customerIds' => [Rule::requiredIf($this->input('audience') === Voucher::AUDIENCE_CUSTOMERS), 'array', 'max:500'],
            'customerIds.*' => ['integer', Rule::exists('users', 'id')->where('role', User::ROLE_CUSTOMER)],
        ];
    }
}
