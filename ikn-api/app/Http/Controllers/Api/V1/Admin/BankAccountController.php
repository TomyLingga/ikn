<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\BankAccountRequest;
use App\Http\Resources\BankAccountResource;
use App\Models\BankAccount;
use App\Support\Money;
use Illuminate\Http\Request;

// Rekening bank tujuan transfer manual (kontrak 11.5).
class BankAccountController extends ApiController
{
    public function index(Request $request)
    {
        $accounts = BankAccount::query()
            ->when($request->query('q'), function ($q, $s) {
                $like = '%'.$s.'%';
                $q->where(function ($w) use ($like) {
                    $w->where('bank_name', 'ilike', $like)->orWhere('account_number', 'ilike', $like)->orWhere('account_holder', 'ilike', $like);
                });
            })
            ->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(BankAccountResource::collection($accounts));
    }

    public function store(BankAccountRequest $request)
    {
        $account = BankAccount::create($this->attributes($request->validated(), null));

        return $this->created(new BankAccountResource($account));
    }

    public function update(BankAccountRequest $request, BankAccount $bankAccount)
    {
        $bankAccount->update($this->attributes($request->validated(), $bankAccount));

        return $this->data(new BankAccountResource($bankAccount->fresh()));
    }

    public function destroy(BankAccount $bankAccount)
    {
        $bankAccount->delete();

        return $this->deleted();
    }

    /** Field rekening USD (ASUMSI A-86) opsional: tidak dikirim = nilai lama dipertahankan, null/kosong = dikosongkan. */
    private function attributes(array $data, ?BankAccount $existing): array
    {
        $optional = function (string $key, ?string $current) use ($data): ?string {
            if (! array_key_exists($key, $data)) {
                return $current;
            }
            $value = trim((string) ($data[$key] ?? ''));

            return $value === '' ? null : $value;
        };

        return [
            'bank_name' => trim($data['bankName']),
            'account_number' => trim($data['accountNumber']),
            'account_holder' => trim($data['accountHolder']),
            'currency' => $data['currency'] ?? ($existing?->currencyCode() ?? Money::CURRENCY_IDR),
            'swift_code' => $optional('swiftCode', $existing?->swift_code),
            'bank_address' => $optional('bankAddress', $existing?->bank_address),
            'correspondent_bank' => $optional('correspondentBank', $existing?->correspondent_bank),
            'is_active' => (bool) ($data['isActive'] ?? true),
            'sort_order' => (int) ($data['sortOrder'] ?? 0),
        ];
    }
}
