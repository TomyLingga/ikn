<?php

namespace App\Http\Requests\Chat;

use App\Models\ChatMessage;
use Illuminate\Foundation\Http\FormRequest;

// Permintaan tamu yang membawa token percakapan: GET /chat/guest?token, POST /chat/guest/messages, POST /chat/guest/read.
class GuestChatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:64'],
            'after' => ['nullable', 'integer', 'min:0'],
            'before' => ['nullable', 'integer', 'min:1'],
            'body' => [$this->isMethod('POST') && $this->is('*/messages') ? 'required' : 'nullable', 'string', 'max:'.ChatMessage::BODY_MAX],
        ];
    }

    public function token(): string
    {
        return (string) $this->validated()['token'];
    }
}
