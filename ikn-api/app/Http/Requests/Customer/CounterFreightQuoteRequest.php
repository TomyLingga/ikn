<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;

// POST /customer/orders/{number}/freight-quotes/counter (kontrak 11.12): { amount (satuan terkecil mata uang order, > 0), note? }.
class CounterFreightQuoteRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('note'))) {
            $this->merge(['note' => trim($this->input('note'))]);
        }
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1', 'max:999999999999'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
