<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

// Titik asal ongkir berbasis jarak (ASUMSI A-76); disimpan sebagai pengaturan commerce shipping_origin_* / shipping_road_factor.
class ShippingOriginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'label' => ['nullable', 'string', 'max:120'],
            'lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:lng'],
            'lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:lat'],
            'roadFactor' => ['required', 'numeric', 'min:1', 'max:3'],
        ];
    }
}
