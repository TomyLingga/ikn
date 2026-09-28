<?php

namespace App\Http\Requests\Admin;

use App\Models\Page;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'slug' => ['required', 'string', 'alpha_dash', 'max:128', 'unique:pages,slug'],
            'status' => ['nullable', Rule::in(Page::STATUSES)],
            'template' => ['nullable', 'string', 'alpha_dash', 'max:64'],
            'seo' => ['nullable', 'array'],
        ], I18n::rules('title', true, 200), I18n::rules('seo.title', false, 200), I18n::rules('seo.description', false, 500));
    }
}
