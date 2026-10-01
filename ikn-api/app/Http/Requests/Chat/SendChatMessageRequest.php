<?php

namespace App\Http\Requests\Chat;

use App\Models\ChatMessage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST /customer/chat/messages dan POST /admin/chats/{id}/messages: { body, context? }.
// context hanya dipakai customer: { type: product, slug } atau { type: order, number }.
class SendChatMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body'))) {
            $this->merge(['body' => trim($this->input('body'))]);
        }
    }

    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:'.ChatMessage::BODY_MAX],
            'context' => ['nullable', 'array'],
            'context.type' => ['required_with:context', 'string', Rule::in(ChatMessage::CONTEXT_TYPES)],
            'context.slug' => ['nullable', 'string', 'max:160', 'required_if:context.type,'.ChatMessage::CONTEXT_PRODUCT],
            'context.number' => ['nullable', 'string', 'max:64', 'required_if:context.type,'.ChatMessage::CONTEXT_ORDER],
        ];
    }

    public function attributes(): array
    {
        $attributes = __('notifications.attributes');

        return is_array($attributes) ? $attributes : [];
    }
}
