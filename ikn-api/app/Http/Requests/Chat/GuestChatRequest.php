<?php

namespace App\Http\Requests\Chat;

use App\Models\ChatMessage;
use Illuminate\Foundation\Http\FormRequest;

// Permintaan tamu yang membawa token percakapan: GET /chat/guest?token, POST /chat/guest/messages,
// PUT /chat/guest/messages/{message}, POST /chat/guest/messages/{message}/retract, POST /chat/guest/read.
class GuestChatRequest extends FormRequest
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
        // Isi wajib saat mengirim pesan baru (POST .../messages) dan saat mengedit (PUT).
        $needsBody = $this->isMethod('PUT') || ($this->isMethod('POST') && $this->is('*/messages'));

        return [
            'token' => ['required', 'string', 'max:64'],
            'after' => ['nullable', 'integer', 'min:0'],
            'before' => ['nullable', 'integer', 'min:1'],
            'rev' => ['nullable', 'integer', 'min:0'],
            'body' => [$needsBody ? 'required' : 'nullable', 'string', 'max:'.ChatMessage::BODY_MAX],
        ];
    }

    public function token(): string
    {
        return (string) $this->validated()['token'];
    }
}
