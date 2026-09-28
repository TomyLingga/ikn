<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\BankAccountRequest;
use App\Http\Resources\BankAccountResource;
use App\Models\BankAccount;
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
        $account = BankAccount::create($this->attributes($request->validated()));

        return $this->created(new BankAccountResource($account));
    }

    public function update(BankAccountRequest $request, BankAccount $bankAccount)
    {
        $bankAccount->update($this->attributes($request->validated()));

        return $this->data(new BankAccountResource($bankAccount->fresh()));
    }

    public function destroy(BankAccount $bankAccount)
    {
        $bankAccount->delete();

        return $this->deleted();
    }

    private function attributes(array $data): array
    {
        return [
            'bank_name' => trim($data['bankName']),
            'account_number' => trim($data['accountNumber']),
            'account_holder' => trim($data['accountHolder']),
            'is_active' => (bool) ($data['isActive'] ?? true),
            'sort_order' => (int) ($data['sortOrder'] ?? 0),
        ];
    }
}
