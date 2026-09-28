<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Account\AccountFormRequest;

// PUT /customer/profile/company: company, companyEmail, companyPhone, taxId.
class UpdateCompanyRequest extends AccountFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeEmail('companyEmail');
    }

    public function rules(): array
    {
        return [
            'company' => ['sometimes', 'nullable', 'string', 'max:160'],
            'companyEmail' => ['sometimes', 'nullable', 'string', 'email', 'max:190'],
            'companyPhone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'taxId' => ['sometimes', 'nullable', 'string', 'max:40'],
        ];
    }
}
