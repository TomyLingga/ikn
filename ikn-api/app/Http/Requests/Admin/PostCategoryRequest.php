<?php

namespace App\Http\Requests\Admin;

use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PostCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $category = $this->route('newsCategory');

        return array_merge([
            'slug' => ['nullable', 'string', 'max:80', Rule::unique('post_categories', 'slug')->ignore($category?->id)],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:1000'],
        ], I18n::rules('name', true, 80));
    }
}
