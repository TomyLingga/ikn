<?php

namespace App\Http\Requests\Admin;

use App\Services\Media\ExternalMedia;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Media dari URL (A-92). Penyedia dan jenis dikenali ExternalMedia; di sini hanya bentuk input.
class StoreMediaUrlRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'url' => ['required', 'string', 'url', 'max:2048'],
            'kind' => ['nullable', Rule::in(ExternalMedia::KINDS)],
            'name' => ['nullable', 'string', 'max:120'],
            'collection' => ['nullable', 'string', 'alpha_dash', 'max:64'],
        ];
    }
}
