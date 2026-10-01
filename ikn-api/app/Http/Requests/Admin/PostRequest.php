<?php

namespace App\Http\Requests\Admin;

use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $post = $this->route('post');

        return array_merge([
            'slug' => ['nullable', 'string', 'max:160', Rule::unique('posts', 'slug')->ignore($post?->id)],
            'categoryId' => ['nullable', 'integer', 'exists:post_categories,id'],
            'author' => ['nullable', 'string', 'max:120'],
            'coverMediaId' => ['nullable', 'integer', 'exists:media,id'],
            'isPublished' => ['nullable', 'boolean'],
            'publishedAt' => ['nullable', 'date'],
        ], I18n::rules('title', true, 200), I18n::rules('excerpt', false, 1000), I18n::rules('body', false, 60000));
    }
}
