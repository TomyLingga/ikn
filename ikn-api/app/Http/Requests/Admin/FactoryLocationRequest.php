<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\FactoryLocation;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST/PUT /admin/factory-locations (kontrak 11.8, ASUMSI A-90): kode slug hanya saat membuat (tidak bisa diubah),
// nama {id,en} wajib id, alamat wajib, lat/lng berpasangan (keduanya null = tanpa pin; tarif per km tidak ditawarkan).
class FactoryLocationRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    /** Kode dinormalkan (trim + lowercase) sebelum regex slug, agar "Sei-Bamban" diterima sebagai "sei-bamban". */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtolower(trim($this->input('code')))]);
        }
        if (is_string($this->input('address'))) {
            $this->merge(['address' => trim(preg_replace('/\s+/u', ' ', $this->input('address')))]);
        }
    }

    public function rules(): array
    {
        /** @var FactoryLocation|null $existing */
        $existing = $this->route('factoryLocation');

        return array_merge([
            'code' => $existing
                ? ['sometimes', 'nullable', 'string', Rule::in([$existing->code])]
                : ['required', 'string', 'max:32', 'regex:/^[a-z0-9][a-z0-9-]*$/', Rule::unique('factory_locations', 'code')],
            'address' => ['required', 'string', 'max:255'],
            // Tanpa `sometimes` agar required_with tetap diperiksa saat pasangannya tidak dikirim.
            'lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:lng'],
            'lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:lat'],
            'allowsPickup' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:-1000', 'max:1000'],
        ], I18n::rules('name', true, 120));
    }

    public function messages(): array
    {
        return ['code.in' => __('catalog.factory_location_code_immutable')];
    }
}
