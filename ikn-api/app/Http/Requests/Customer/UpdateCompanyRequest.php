<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Account\AccountFormRequest;
use App\Support\Countries;
use Illuminate\Validation\Rule;

// PUT /customer/profile/company: company, companyEmail, companyPhone, taxId, companyAddress, countryCode.
// countryCode dan companyAddress hanya bisa diubah selagi akun masih pending (ASUMSI A-86); ProfileController menolak sisanya.
class UpdateCompanyRequest extends AccountFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeEmail('companyEmail');
        if (is_string($this->input('countryCode'))) {
            $this->merge(['countryCode' => Countries::normalize($this->input('countryCode'))]);
        }
    }

    public function rules(): array
    {
        return [
            'company' => ['sometimes', 'nullable', 'string', 'max:160'],
            'companyEmail' => ['sometimes', 'nullable', 'string', 'email', 'max:190'],
            'companyPhone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'taxId' => ['sometimes', 'nullable', 'string', 'max:40'],
            'companyAddress' => ['sometimes', 'nullable', 'string', 'max:500'],
            'countryCode' => ['sometimes', 'nullable', 'string', 'size:2', Rule::in(Countries::codes())],
        ];
    }
}
