<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CategoryRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $category = $this->route('category');

        return array_merge([
            'slug' => ['nullable', 'string', 'max:120', Rule::unique('categories', 'slug')->ignore($category?->id)],
            'imageMediaId' => ['nullable', 'integer', 'exists:media,id'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'isActive' => ['nullable', 'boolean'],
        ], I18n::rules('name', true, 160), I18n::rules('description', false, 2000));
    }
}
