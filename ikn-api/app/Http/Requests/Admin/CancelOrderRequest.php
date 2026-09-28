<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;

// POST /admin/orders/{number}/cancel: { reason } (kontrak 11.2). Dipakai juga customer cancel (reason opsional).
class CancelOrderRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->user() && $this->user()->isAdmin() ? 'required' : 'nullable';

        return [
            'reason' => [$required, 'string', 'max:1000'],
        ];
    }
}
