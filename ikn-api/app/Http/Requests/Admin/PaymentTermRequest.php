<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use App\Models\PaymentTerm;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST/PUT /admin/payment-terms (kontrak 11.10, ASUMSI A-87): kode hanya saat membuat (tidak bisa diubah), nama {id,en} wajib id.
class PaymentTermRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    /** Kode dinormalkan (trim + lowercase) sebelum regex slug. */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtolower(trim($this->input('code')))]);
        }
    }

    public function rules(): array
    {
        /** @var PaymentTerm|null $existing */
        $existing = $this->route('paymentTerm');

        return array_merge([
            'code' => $existing
                ? ['sometimes', 'nullable', 'string', Rule::in([$existing->code])]
                : ['required', 'string', 'max:32', 'regex:/^[a-z0-9][a-z0-9_-]*$/', Rule::unique('payment_terms', 'code')],
            'market' => ['nullable', 'string', Rule::in(PaymentTerm::MARKETS)],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:-1000', 'max:1000'],
        ], I18n::rules('name', true, 160), I18n::rules('description', false, 500));
    }

    public function messages(): array
    {
        return ['code.in' => __('commerce.payment_term_code_immutable')];
    }
}
