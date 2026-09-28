<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;

// POST /customer/orders (kontrak bagian 9): body sama dengan /cart/quote, tetapi alamat, tarif, dan metode bayar wajib.
class CheckoutRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.productSlug' => ['required_without:items.*.productId', 'nullable', 'string', 'max:160'],
            'items.*.productId' => ['nullable', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'addressId' => ['required', 'integer'],
            'shippingRateId' => ['required', 'integer'],
            'paymentMethodCode' => ['required', 'string', 'max:64'],
            'bankAccountId' => ['nullable', 'integer'],
            'voucherCode' => ['nullable', 'string', 'max:64'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function idempotencyKey(): ?string
    {
        $key = trim((string) $this->header('Idempotency-Key', ''));

        return $key === '' ? null : $key;
    }
}
