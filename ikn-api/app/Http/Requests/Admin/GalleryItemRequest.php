<?php

namespace App\Http\Requests\Admin;

use App\Models\GalleryItem;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GalleryItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'type' => ['required', Rule::in(GalleryItem::TYPES)],
            'mediaId' => ['required_if:type,'.GalleryItem::TYPE_IMAGE, 'nullable', 'integer', 'exists:media,id'],
            'externalUrl' => ['required_if:type,'.GalleryItem::TYPE_VIDEO, 'nullable', 'string', 'max:300'],
            'isPublished' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ], I18n::rules('title', true, 200));
    }
}
