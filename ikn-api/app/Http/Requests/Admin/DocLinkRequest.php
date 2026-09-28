<?php

namespace App\Http\Requests\Admin;

use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;

class DocLinkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'category' => ['required', 'string', 'alpha_dash', 'max:64'],
            'mediaId' => ['nullable', 'integer', 'exists:media,id'],
            'url' => ['nullable', 'string', 'max:500'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ], I18n::rules('label', true, 150), I18n::rules('description', false, 300));
    }
}
