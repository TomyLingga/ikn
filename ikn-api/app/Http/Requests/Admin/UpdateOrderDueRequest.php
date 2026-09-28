<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

// PUT /admin/orders/{number}/due: { paymentDueAt } (ISO-8601) atau { extendHours: 1..720 } (kontrak 11.2).
class UpdateOrderDueRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'paymentDueAt' => ['required_without:extendHours', 'nullable', 'date'],
            'extendHours' => ['required_without:paymentDueAt', 'nullable', 'integer', 'min:1', 'max:720'],
        ];
    }

    public function messages(): array
    {
        return [
            'paymentDueAt.required_without' => __('commerce.due_required'),
            'extendHours.required_without' => __('commerce.due_required'),
        ];
    }

    /** Batas waktu baru: nilai absolut, atau batas waktu saat ini (atau sekarang bila sudah lewat) + extendHours. */
    public function resolveDue(?Carbon $currentDue): Carbon
    {
        $data = $this->validated();
        if (! empty($data['paymentDueAt'])) {
            return Carbon::parse($data['paymentDueAt']);
        }

        $base = $currentDue && $currentDue->gt(now()) ? $currentDue->copy() : now();

        return $base->addHours((int) $data['extendHours']);
    }
}
