<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\ShippingRate;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ShippingRateRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'zoneId' => ['nullable', 'integer', 'exists:shipping_zones,id'],
            'type' => ['required', Rule::in([...ShippingRate::TYPES, ShippingRate::TYPE_PER_KG])],
            'baseAmount' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'perKmAmount' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'perKgAmount' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'perM3Amount' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'minAmount' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'freeAbove' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ], I18n::rules('name', true, 120), I18n::rules('eta', false, 120));
    }
}
