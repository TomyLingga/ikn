<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST /admin/orders/{number}/status: { status: processing|shipped|delivered|completed, note?, courier?, trackingNumber? }.
// shipped wajib kurir + resi (kontrak 11.2).
class UpdateOrderStatusRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(Order::ADMIN_TARGET_STATUSES)],
            'note' => ['nullable', 'string', 'max:1000'],
            'courier' => ['nullable', 'string', 'max:120', 'required_if:status,'.Order::STATUS_SHIPPED],
            'trackingNumber' => ['nullable', 'string', 'max:120', 'required_if:status,'.Order::STATUS_SHIPPED],
        ];
    }

    public function messages(): array
    {
        return [
            'courier.required_if' => __('commerce.shipping_required'),
            'trackingNumber.required_if' => __('commerce.shipping_required'),
        ];
    }
}
