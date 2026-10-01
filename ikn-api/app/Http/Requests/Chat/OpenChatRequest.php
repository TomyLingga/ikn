<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;

// POST /admin/chats: { customerId } membuka (atau membuat) percakapan dengan customer itu.
class OpenChatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customerId' => ['required', 'integer', 'min:1'],
        ];
    }

    public function attributes(): array
    {
        $attributes = __('notifications.attributes');

        return is_array($attributes) ? $attributes : [];
    }
}
