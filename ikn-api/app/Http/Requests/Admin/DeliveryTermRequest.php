<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\DeliveryTerm;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST/PUT /admin/delivery-terms (kontrak 11.8): kode hanya saat membuat (tidak bisa diubah), nama {id,en} wajib id.
class DeliveryTermRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    /** Kode dinormalkan (trim + lowercase) sebelum regex slug, agar "Loco" diterima sebagai "loco". */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtolower(trim($this->input('code')))]);
        }
    }

    public function rules(): array
    {
        /** @var DeliveryTerm|null $existing */
        $existing = $this->route('deliveryTerm');

        return array_merge([
            'code' => $existing
                ? ['sometimes', 'nullable', 'string', Rule::in([$existing->code])]
                : ['required', 'string', 'max:32', 'regex:/^[a-z0-9][a-z0-9_-]*$/', Rule::unique('delivery_terms', 'code')],
            'family' => ['required', 'string', Rule::in(DeliveryTerm::FAMILIES)],
            'market' => ['required', 'string', Rule::in(DeliveryTerm::MARKETS)],
            'pricingMode' => ['required', 'string', Rule::in(DeliveryTerm::PRICING_MODES)],
            // Pajak mengikuti term (ASUMSI A-86); kosong = export untuk pasar ekspor, domestic untuk lokal.
            'taxProfile' => ['nullable', 'string', Rule::in(DeliveryTerm::TAX_PROFILES)],
            'insuranceIncluded' => ['nullable', 'boolean'],
            'requiresDestinationPort' => ['nullable', 'boolean'],
            'loadingPort' => ['nullable', 'string', 'max:120'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:-1000', 'max:1000'],
        ], I18n::rules('name', true, 120), I18n::rules('description', false, 500));
    }

    public function messages(): array
    {
        return ['code.in' => __('catalog.delivery_term_code_immutable')];
    }
}
