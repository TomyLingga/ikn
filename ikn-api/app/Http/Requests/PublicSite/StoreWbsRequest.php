<?php

namespace App\Http\Requests\PublicSite;

use Illuminate\Foundation\Http\FormRequest;

// Menerima juga nama lama dari mockup (anonymous, contact) demi kompatibilitas.
class StoreWbsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        if (! $this->has('isAnonymous') && $this->has('anonymous')) {
            $merge['isAnonymous'] = $this->input('anonymous');
        }
        if (! $this->has('reporterContact') && $this->has('contact')) {
            $merge['reporterContact'] = $this->input('contact');
        }
        if (! $this->has('isAnonymous') && ! $this->has('anonymous')) {
            $merge['isAnonymous'] = true;
        }
        $this->merge($merge);
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
            'isAnonymous' => ['required', 'boolean'],
            'reporterName' => ['nullable', 'string', 'max:120'],
            'reporterContact' => ['required_if:isAnonymous,false', 'nullable', 'string', 'max:160'],
            'attachment' => ['nullable', 'file'],
        ];
    }
}
