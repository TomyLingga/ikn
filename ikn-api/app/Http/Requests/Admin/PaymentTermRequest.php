<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use App\Models\PaymentTerm;
use App\Services\Commerce\InstallmentSchedule;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

// POST/PUT /admin/payment-terms (kontrak 11.10, ASUMSI A-87): kode hanya saat membuat (tidak bisa diubah), nama {id,en} wajib id.
// installments[] (ASUMSI A-97) = jadwal termin: kosong berarti satu pembayaran penuh; terisi: maksimal 6 baris, persen
// berjumlah tepat 100, baris pertama ditagih saat pesanan dibuat, key unik, hanya untuk syarat pasar ekspor.
class PaymentTermRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    /** Kode dinormalkan (trim + lowercase) sebelum regex slug. */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtolower(trim($this->input('code')))]);
        }
    }

    public function rules(): array
    {
        /** @var PaymentTerm|null $existing */
        $existing = $this->route('paymentTerm');

        return array_merge([
            'code' => $existing
                ? ['sometimes', 'nullable', 'string', Rule::in([$existing->code])]
                : ['required', 'string', 'max:32', 'regex:/^[a-z0-9][a-z0-9_-]*$/', Rule::unique('payment_terms', 'code')],
            'market' => ['nullable', 'string', Rule::in(PaymentTerm::MARKETS)],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:-1000', 'max:1000'],
            'installments' => ['sometimes', 'nullable', 'array', 'max:'.InstallmentSchedule::MAX_ROWS],
            'installments.*' => ['array'],
            'installments.*.key' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z0-9][A-Za-z0-9_-]*$/'],
            'installments.*.label' => ['required', 'array'],
            'installments.*.label.id' => ['required', 'string', 'max:80'],
            'installments.*.label.en' => ['nullable', 'string', 'max:80'],
            'installments.*.percent' => ['required', 'numeric', 'gt:0', 'max:100', 'regex:/^\d{1,3}(\.\d{1,2})?$/'],
            'installments.*.trigger' => ['required', 'string', Rule::in(InstallmentSchedule::TRIGGERS)],
            'installments.*.dueDays' => ['nullable', 'integer', 'min:0', 'max:'.InstallmentSchedule::MAX_DUE_DAYS],
        ], I18n::rules('name', true, 160), I18n::rules('description', false, 500));
    }

    /** Aturan lintas baris (jumlah 100%, pemicu baris pertama, key unik) setelah aturan per field lolos. */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            /** @var PaymentTerm|null $existing */
            $existing = $this->route('paymentTerm');
            // Jadwal yang berlaku setelah simpan: yang dikirim, atau jadwal lama bila field tidak dikirim (PUT parsial).
            $rows = $this->has('installments')
                ? InstallmentSchedule::normalize($this->input('installments'))
                : ($existing ? ($existing->installmentRows() ?: null) : null);
            if ($rows === null) {
                return;
            }
            foreach (InstallmentSchedule::violations($rows) as $violation) {
                $validator->errors()->add('installments', __('commerce.installments.'.$violation, ['max' => InstallmentSchedule::MAX_ROWS]));
            }
            $market = $this->input('market') ?: ($existing?->market ?? PaymentTerm::MARKET_EXPORT);
            if ($market !== PaymentTerm::MARKET_EXPORT) {
                $validator->errors()->add('installments', __('commerce.installments.export_only'));
            }
        });
    }

    public function messages(): array
    {
        return ['code.in' => __('commerce.payment_term_code_immutable')];
    }
}
