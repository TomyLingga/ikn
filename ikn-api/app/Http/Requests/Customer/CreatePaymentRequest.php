<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;

// POST /customer/orders/{number}/payments: { paymentMethodCode, bankAccountId? } (ganti metode bayar, kontrak bagian 10).
class CreatePaymentRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'paymentMethodCode' => ['required', 'string', 'max:64'],
            'bankAccountId' => ['nullable', 'integer'],
        ];
    }
}
