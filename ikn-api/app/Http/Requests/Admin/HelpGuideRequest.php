<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class HelpGuideRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::in(['url', 'file'])],
            'url' => ['required_if:type,url', 'nullable', 'string', 'max:500'],
            'file' => ['nullable', 'file'],
        ];
    }
}
