<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;

// POST /customer/orders/{number}/proof (multipart): file (jpg/png/pdf ≤ 5 MB, dicek ulang MediaService), paymentId?.
class UploadProofRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.(int) config('ikn.commerce.proof_max_kb', 5120)],
            'paymentId' => ['nullable', 'integer'],
        ];
    }
}
