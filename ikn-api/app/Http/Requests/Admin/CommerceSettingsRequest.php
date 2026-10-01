<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use Illuminate\Foundation\Http\FormRequest;

// PUT /admin/settings (kontrak 11.5): parsial, kunci camelCase; validasi rentang juga diulang di CommerceSettings.
class CommerceSettingsRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'paymentDueHours' => ['sometimes', 'required', 'integer', 'min:1', 'max:720'],
            'uniqueCodeEnabled' => ['sometimes', 'required', 'boolean'],
            'taxRate' => ['sometimes', 'required', 'numeric', 'min:0', 'max:100'],
            'priceIncludesTax' => ['sometimes', 'required', 'boolean'],
            'autoCompleteDays' => ['sometimes', 'required', 'integer', 'min:0', 'max:90'],
            'reminderHoursBeforeDue' => ['sometimes', 'required', 'integer', 'min:0', 'max:168'],
            'invoicePrefix' => ['sometimes', 'required', 'string', 'max:40', 'regex:/^[A-Za-z0-9.\-\/ ]+$/'],
            'invoiceSignerName' => ['sometimes', 'nullable', 'string', 'max:120'],
            'invoiceSignerTitle' => ['sometimes', 'nullable', 'string', 'max:120'],
            'invoiceCc' => ['sometimes', 'nullable', 'string', 'max:120'],
            'shippingOriginLabel' => ['sometimes', 'nullable', 'string', 'max:120'],
            'shippingOriginLat' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'shippingOriginLng' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'shippingRoadFactor' => ['sometimes', 'required', 'numeric', 'min:1', 'max:3'],
        ];
    }
}
