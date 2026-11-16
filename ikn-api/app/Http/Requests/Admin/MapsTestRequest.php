<?php

namespace App\Http\Requests\Admin;

use App\Services\Cms\SettingsService;
use App\Support\TileUrlTemplate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST /admin/site-settings/maps-test: uji penyedia tile memakai `maps` dari form (belum disimpan) atau pengaturan
// tersimpan bila `maps` tidak dikirim. `maps.google_api_key` boleh SECRET_MASK = pakai key tersimpan.
class MapsTestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tileUrl = function ($attribute, $value, $fail) {
            if (is_string($value) && $value !== '' && ! TileUrlTemplate::isValid(trim($value))) {
                $fail(__('maps.tile_url_invalid', ['attribute' => $attribute]));
            }
        };

        return [
            'maps' => ['nullable', 'array'],
            'maps.provider' => ['nullable', Rule::in(SettingsService::MAP_PROVIDERS)],
            'maps.google_api_key' => ['nullable', 'string', 'max:255'],
            'maps.custom_street_url' => ['nullable', 'string', 'max:'.TileUrlTemplate::MAX_LENGTH, $tileUrl],
            'maps.custom_satellite_url' => ['nullable', 'string', 'max:'.TileUrlTemplate::MAX_LENGTH, $tileUrl],
            'maps.custom_attribution' => ['nullable', 'string', 'max:300'],
            'maps.custom_max_zoom' => ['nullable', 'integer', 'min:1', 'max:22'],
        ];
    }
}
