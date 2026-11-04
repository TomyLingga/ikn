<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Account\AccountFormRequest;
use App\Models\CustomerProfile;
use App\Models\User;
use App\Services\Account\CustomerStatusService;
use Illuminate\Validation\Rule;

// PUT /admin/customers/{customer}/status: { status: active|rejected|inactive, reason?, market? } (kontrak 11.4).
// market (local|export, ASUMSI A-86) dikunci admin saat menyetujui; diabaikan untuk status lain.
class UpdateCustomerStatusRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(CustomerStatusService::TARGET_STATUSES)],
            'reason' => ['nullable', 'string', 'max:1000', 'required_if:status,'.User::STATUS_REJECTED],
            'market' => ['nullable', 'string', Rule::in(CustomerProfile::MARKETS)],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required_if' => __('account.status_reason_required'),
        ];
    }
}
