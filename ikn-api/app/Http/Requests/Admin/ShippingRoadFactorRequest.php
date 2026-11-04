<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use Illuminate\Foundation\Http\FormRequest;

// PUT /admin/shipping/road-factor (kontrak 11.8, ASUMSI A-76/A-90): faktor jalan ongkir per km, setting commerce shipping_road_factor.
class ShippingRoadFactorRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['roadFactor' => ['required', 'numeric', 'min:1', 'max:3']];
    }
}
