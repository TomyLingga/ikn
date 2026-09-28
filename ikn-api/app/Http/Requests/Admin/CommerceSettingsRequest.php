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
        ];
    }
}
