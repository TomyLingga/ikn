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
            // Ekspor (ASUMSI A-86): pajak term ekspor (bawaan 0) dan batas bayar order USD (bawaan 120 jam).
            'exportTaxRate' => ['sometimes', 'required', 'numeric', 'min:0', 'max:100'],
            'exportPaymentDueHours' => ['sometimes', 'required', 'integer', 'min:1', 'max:720'],
            // Penawaran ongkir CIF (ASUMSI A-89): masa berlaku bawaan (hari) dan batas tunggu sebelum batal otomatis (hari).
            'freightQuoteValidDays' => ['sometimes', 'required', 'integer', 'min:1', 'max:90'],
            'freightQuoteMaxDays' => ['sometimes', 'required', 'integer', 'min:1', 'max:365'],
            'invoicePrefix' => ['sometimes', 'required', 'string', 'max:40', 'regex:/^[A-Za-z0-9.\-\/ ]+$/'],
            'invoiceSignerName' => ['sometimes', 'nullable', 'string', 'max:120'],
            'invoiceSignerTitle' => ['sometimes', 'nullable', 'string', 'max:120'],
            'invoiceCc' => ['sometimes', 'nullable', 'string', 'max:120'],
            // Titik asal ongkir dan titik ambil Loco = /admin/factory-locations (ASUMSI A-90); di sini hanya faktor jalan.
            'shippingRoadFactor' => ['sometimes', 'required', 'numeric', 'min:1', 'max:3'],
        ];
    }
}
