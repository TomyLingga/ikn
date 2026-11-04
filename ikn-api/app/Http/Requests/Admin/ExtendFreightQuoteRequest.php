<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

// PUT /admin/orders/{number}/freight-quotes/{quote}/extend (kontrak 11.12): { validUntil } wajib, di masa depan (diperiksa service).
class ExtendFreightQuoteRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'validUntil' => ['required', 'date'],
        ];
    }

    public function validUntil(): Carbon
    {
        return FreightQuoteRequest::parseValidUntil($this->validated()['validUntil']);
    }
}
