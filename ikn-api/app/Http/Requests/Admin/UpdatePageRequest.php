<?php

namespace App\Http\Requests\Admin;

use App\Models\Page;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $page = $this->route('page');

        $title = I18n::rules('title', true, 200);
        $title['title'] = ['sometimes', 'required', 'array'];
        $title['title.id'] = ['sometimes', 'required', 'string', 'max:200'];

        return array_merge([
            'slug' => ['sometimes', 'required', 'string', 'alpha_dash', 'max:128', Rule::unique('pages', 'slug')->ignore($page?->id)],
            'status' => ['sometimes', 'required', Rule::in(Page::STATUSES)],
            'template' => ['sometimes', 'nullable', 'string', 'alpha_dash', 'max:64'],
            'seo' => ['sometimes', 'nullable', 'array'],
        ], $title, I18n::rules('seo.title', false, 200), I18n::rules('seo.description', false, 500));
    }
}
