<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

// POST /admin/orders/{number}/attachments (multipart): file (pdf/gambar/office ≤ ikn.commerce.attachment_max_kb), label?.
class StoreOrderAttachmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.(int) config('ikn.commerce.attachment_max_kb', 10240)],
            'label' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function attributes(): array
    {
        return ['file' => 'berkas', 'label' => 'keterangan'];
    }
}
