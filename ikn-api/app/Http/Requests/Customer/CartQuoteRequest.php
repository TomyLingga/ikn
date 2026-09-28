<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Concerns\CatalogAttributes;
use Illuminate\Foundation\Http\FormRequest;

// Body POST /cart/quote = body POST /customer/orders (kontrak bagian 9); bankAccountId/note diterima tetapi tidak dipakai quote.
class CartQuoteRequest extends FormRequest
{
    use CatalogAttributes;

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
            'addressId' => ['nullable', 'integer'],
            'shippingRateId' => ['nullable', 'integer'],
            'paymentMethodCode' => ['nullable', 'string', 'max:64'],
            'bankAccountId' => ['nullable', 'integer'],
            'voucherCode' => ['nullable', 'string', 'max:64'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
