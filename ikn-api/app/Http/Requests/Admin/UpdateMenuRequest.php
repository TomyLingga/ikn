<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

// Pohon menu maksimal dua tingkat: items[] dan items[].children[].
class UpdateMenuRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rules = ['items' => ['present', 'array', 'max:20']];

        foreach (['items.*', 'items.*.children.*'] as $path) {
            $rules[$path.'.key'] = ['nullable', 'string', 'alpha_dash', 'max:64'];
            $rules[$path.'.label'] = ['required', 'array'];
            $rules[$path.'.label.id'] = ['required', 'string', 'max:120'];
            $rules[$path.'.label.en'] = ['nullable', 'string', 'max:120'];
            $rules[$path.'.description'] = ['nullable', 'array'];
            $rules[$path.'.description.id'] = ['nullable', 'string', 'max:200'];
            $rules[$path.'.description.en'] = ['nullable', 'string', 'max:200'];
            $rules[$path.'.url'] = ['nullable', 'string', 'max:500'];
            $rules[$path.'.isActive'] = ['nullable', 'boolean'];
        }

        $rules['items.*.children'] = ['nullable', 'array', 'max:20'];

        return $rules;
    }
}
