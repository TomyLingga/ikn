<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Account\AccountFormRequest;
use App\Services\Account\CustomerStatusService;
use App\Models\User;
use Illuminate\Validation\Rule;

// PUT /admin/customers/{customer}/status: { status: active|rejected|inactive, reason? } (kontrak 11.4).
class UpdateCustomerStatusRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(CustomerStatusService::TARGET_STATUSES)],
            'reason' => ['nullable', 'string', 'max:1000', 'required_if:status,'.User::STATUS_REJECTED],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required_if' => __('account.status_reason_required'),
        ];
    }
}
