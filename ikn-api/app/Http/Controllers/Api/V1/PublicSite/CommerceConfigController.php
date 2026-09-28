<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\FeeResource;
use App\Models\BankAccount;
use App\Models\Fee;
use App\Models\PaymentMethod;
use App\Services\Commerce\CommerceSettings;

// GET /commerce/config dan GET /payment-methods (kontrak bagian 9 dan 10): hanya data aktif, tanpa config rahasia.
class CommerceConfigController extends ApiController
{
    public function config(CommerceSettings $settings)
    {
        $api = $settings->toApi();

        return $this->data([
            'paymentMethods' => $this->activeMethods(),
            'bankAccounts' => BankAccount::active()->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (BankAccount $account) => $account->toSummary() + ['isActive' => true])->values()->all(),
            'fees' => FeeResource::collection(Fee::active()->orderBy('sort_order')->orderBy('id')->get())->resolve(),
            'paymentDueHours' => $api['paymentDueHours'],
            'taxRate' => $api['taxRate'],
            'priceIncludesTax' => $api['priceIncludesTax'],
            'uniqueCodeEnabled' => $api['uniqueCodeEnabled'],
            'autoCompleteDays' => $api['autoCompleteDays'],
        ]);
    }

    public function paymentMethods()
    {
        return $this->data($this->activeMethods());
    }

    private function activeMethods(): array
    {
        return PaymentMethod::active()->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn (PaymentMethod $method) => $method->toPublicArray())->values()->all();
    }
}
