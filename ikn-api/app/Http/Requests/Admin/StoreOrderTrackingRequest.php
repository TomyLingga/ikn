<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

// POST /admin/orders/{number}/tracking: { note } catatan perjalanan kiriman (ASUMSI A-70).
class StoreOrderTrackingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('note'))) {
            $this->merge(['note' => trim(preg_replace('/\s+/u', ' ', $this->input('note')))]);
        }
    }

    public function rules(): array
    {
        return [
            'note' => ['required', 'string', 'min:3', 'max:200'],
        ];
    }

    public function attributes(): array
    {
        $attributes = __('notifications.attributes');

        return is_array($attributes) ? $attributes : [];
    }
}
