<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use Illuminate\Foundation\Http\FormRequest;

class PublishProductRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['isPublished' => ['required', 'boolean']];
    }
}
