<?php

namespace App\Http\Requests\Admin;

use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CertificateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            // Berkas sertifikat: hanya PDF. Logo: hanya gambar.
            'mediaId' => ['nullable', 'integer', Rule::exists('media', 'id')->where('mime', 'application/pdf')],
            'logoMediaId' => ['nullable', 'integer', Rule::exists('media', 'id')->where(fn ($q) => $q->where('mime', 'like', 'image/%'))],
            'isPublished' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ], I18n::rules('name', true, 200), I18n::rules('material', false, 200), I18n::rules('description', false, 2000));
    }
}
