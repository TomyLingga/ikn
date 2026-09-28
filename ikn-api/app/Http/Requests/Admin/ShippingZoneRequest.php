<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\ShippingZoneRegion;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Zona ongkir + regions[] { code, level } (kontrak 11.5). Zona tanpa region atau isDefault = cadangan.
class ShippingZoneRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'isActive' => ['nullable', 'boolean'],
            'isDefault' => ['nullable', 'boolean'],
            'priority' => ['nullable', 'integer', 'min:-1000', 'max:1000'],
            'regions' => ['nullable', 'array', 'max:5000'],
            'regions.*.code' => ['required', 'string', 'max:16'],
            'regions.*.level' => ['required', Rule::in(ShippingZoneRegion::LEVELS)],
        ], I18n::rules('name', true, 160));
    }
}
