<?php

namespace App\Http\Requests\Admin;

use App\Services\Cms\SectionRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Konten divalidasi terhadap skema registry di controller (ValidatesSectionContent).
class StoreSectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(array_keys(app(SectionRegistry::class)->types()))],
            'key' => ['nullable', 'string', 'alpha_dash', 'max:64'],
            'content' => ['nullable', 'array'],
            'isVisible' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return ['type.in' => __('api.section_type_unknown')];
    }
}
