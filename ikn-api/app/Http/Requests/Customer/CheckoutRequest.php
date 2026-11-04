<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Concerns\CommerceAttributes;
use App\Services\Commerce\DeliveryTermResolver;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

// POST /customer/orders (kontrak bagian 9): body sama dengan /cart/quote; metode bayar wajib; alamat + tarif wajib
// hanya bila cara serah terima memakai tarif zona (Franco), bukan untuk Loco/FOB (ASUMSI A-85). paymentTermCode
// (ASUMSI A-87) wajib untuk customer ekspor; keberadaan/pasarnya diperiksa PaymentTermResolver di CheckoutService.
// destinationPort (ASUMSI A-89) wajib bila term mewajibkan pelabuhan tujuan (CIF): nama + negara + pin peta.
class CheckoutRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $port = $this->input('destinationPort');
        if (is_array($port)) {
            foreach (['name', 'country', 'countryCode'] as $field) {
                if (isset($port[$field]) && is_string($port[$field])) {
                    $port[$field] = trim(preg_replace('/\s+/u', ' ', $port[$field]));
                    if ($port[$field] === '') {
                        $port[$field] = null;
                    }
                }
            }
            if (isset($port['countryCode']) && is_string($port['countryCode'])) {
                $port['countryCode'] = strtoupper($port['countryCode']);
            }
            $this->merge(['destinationPort' => $port]);
        }
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.productSlug' => ['required_without:items.*.productId', 'nullable', 'string', 'max:160'],
            'items.*.productId' => ['nullable', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'deliveryTermCode' => ['nullable', 'string', 'max:32', 'exists:delivery_terms,code'],
            'paymentTermCode' => ['nullable', 'string', 'max:32'],
            'addressId' => ['nullable', 'integer'],
            'shippingRateId' => ['nullable', 'integer'],
            'paymentMethodCode' => ['required', 'string', 'max:64'],
            'bankAccountId' => ['nullable', 'integer'],
            'voucherCode' => ['nullable', 'string', 'max:64'],
            'note' => ['nullable', 'string', 'max:1000'],
            'destinationPort' => ['nullable', 'array'],
            'destinationPort.name' => ['nullable', 'string', 'max:120'],
            'destinationPort.country' => ['nullable', 'string', 'max:80'],
            'destinationPort.countryCode' => ['nullable', 'string', 'regex:/^[A-Z]{2}$/'],
            'destinationPort.lat' => ['nullable', 'numeric', 'between:-90,90'],
            'destinationPort.lng' => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        // Term tidak sah dibiarkan lolos di sini: CheckoutService yang menolaknya dengan pesan deliveryTermCode.
        $resolve = function ($input) {
            $market = $this->user() ? $this->user()->market() : \App\Models\DeliveryTerm::MARKET_LOCAL;

            return app(DeliveryTermResolver::class)->tryResolve($input->deliveryTermCode ?? null, $market);
        };
        $validator->sometimes(['addressId', 'shippingRateId'], 'required', fn ($input) => ($term = $resolve($input)) !== null && $term->usesZone());
        $validator->sometimes(
            ['destinationPort', 'destinationPort.name', 'destinationPort.country', 'destinationPort.lat', 'destinationPort.lng'],
            'required',
            fn ($input) => ($term = $resolve($input)) !== null && (bool) $term->requires_destination_port
        );
    }

    public function idempotencyKey(): ?string
    {
        $key = trim((string) $this->header('Idempotency-Key', ''));

        return $key === '' ? null : $key;
    }
}
