<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;

// PUT /admin/orders/{number}/proforma (kontrak 11.11, ASUMSI A-88): semua field opsional; field kosong = null.
class ProformaRequest extends FormRequest
{
    use CommerceAttributes;

    public const FIELDS = ['vesselName', 'voyage', 'etd', 'eta', 'portOfLoading', 'portOfDischarge', 'paymentTerms', 'notes', 'validUntil'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (self::FIELDS as $field) {
            $value = $this->input($field);
            if (is_string($value)) {
                $value = trim($value);
                $merge[$field] = $value === '' ? null : $value;
            }
        }
        $this->merge($merge);
    }

    public function rules(): array
    {
        return [
            'vesselName' => ['nullable', 'string', 'max:120'],
            'voyage' => ['nullable', 'string', 'max:60'],
            'etd' => ['nullable', 'date'],
            'eta' => ['nullable', 'date'],
            'portOfLoading' => ['nullable', 'string', 'max:120'],
            'portOfDischarge' => ['nullable', 'string', 'max:120'],
            'paymentTerms' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'validUntil' => ['nullable', 'date'],
        ];
    }

    /** Semua field (yang tidak dikirim = null) agar PUT mengganti seluruh isi proforma. */
    public function proformaData(): array
    {
        $validated = $this->validated();
        $out = [];
        foreach (self::FIELDS as $field) {
            $out[$field] = $validated[$field] ?? null;
        }

        return $out;
    }
}
