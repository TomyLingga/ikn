<?php

namespace App\Http\Requests\Chat;

use App\Models\ChatMessage;
use Illuminate\Foundation\Http\FormRequest;

// PUT /customer/chat/messages/{message} dan PUT /admin/chats/{conversation}/messages/{message}: { body }.
// Hanya isi teks yang bisa diubah; rujukan produk/order pada pesan tetap. Kepemilikan dan batas waktu diperiksa
// ChatService (ASUMSI A-99).
class EditChatMessageRequest extends FormRequest
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
        ];
    }

    public function attributes(): array
    {
        $attributes = __('notifications.attributes');

        return is_array($attributes) ? $attributes : [];
    }
}
