<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

// Mime dan ukuran divalidasi di MediaService (deteksi finfo), di sini hanya keberadaan berkas.
class StoreMediaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file'],
            'collection' => ['nullable', 'string', 'alpha_dash', 'max:64'],
        ];
    }
}
