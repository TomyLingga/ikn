<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\PaymentMethod;
use App\Support\I18n;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Metode bayar (kontrak 11.5): config hanya kunci non-rahasia (PaymentMethod::CONFIG_KEYS); kredensial gateway di .env.
class PaymentMethodRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtolower(trim($this->input('code')))]);
        }
    }

    public function rules(): array
    {
        $method = $this->route('paymentMethod');

        return array_merge([
            'code' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_]+$/', Rule::unique('payment_methods', 'code')->ignore($method?->id)],
            'type' => ['required', Rule::in(PaymentMethod::TYPES)],
            'driver' => ['nullable', Rule::in(PaymentMethod::DRIVERS)],
            'config' => ['nullable', 'array'],
            'config.qrisMediaId' => ['nullable', 'integer', 'exists:media,id'],
            'config.channelCode' => ['nullable', 'string', 'max:64'],
            'config.bankCode' => ['nullable', 'string', 'max:64'],
            'config.feePercent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'config.feeFixed' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ], I18n::rules('name', true, 120), I18n::rules('instructions', false, 5000));
    }

    /** config yang sudah disaring ke whitelist (kunci lain dibuang, termasuk apa pun yang tampak rahasia). */
    public function cleanConfig(): array
    {
        $config = $this->validated()['config'] ?? [];
        $clean = [];
        foreach (PaymentMethod::CONFIG_KEYS as $key) {
            if (array_key_exists($key, $config) && $config[$key] !== null && $config[$key] !== '') {
                $clean[$key] = $config[$key];
            }
        }
        if (isset($clean['qrisMediaId'])) {
            $clean['qrisMediaId'] = (int) $clean['qrisMediaId'];
        }

        return $clean;
    }
}
