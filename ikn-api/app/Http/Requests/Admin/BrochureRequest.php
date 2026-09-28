<?php

namespace App\Http\Requests\Admin;

use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;

class BrochureRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'mediaId' => ['nullable', 'integer', 'exists:media,id'],
            'isPublished' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ], I18n::rules('title', true, 200), I18n::rules('description', false, 1000));
    }
}
