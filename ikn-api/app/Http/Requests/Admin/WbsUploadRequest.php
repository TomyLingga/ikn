<?php

namespace App\Http\Requests\Admin;

use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;

class WbsUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'file' => ['required', 'file'],
        ], I18n::rules('label', false, 150), I18n::rules('description', false, 300));
    }
}
