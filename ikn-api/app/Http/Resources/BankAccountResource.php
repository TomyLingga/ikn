<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class BankAccountResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'bankName' => $this->bank_name,
            'accountNumber' => $this->account_number,
            'accountHolder' => $this->account_holder,
            // Rekening USD (ASUMSI A-86): SWIFT, alamat bank, bank koresponden untuk instruksi bayar dan invoice ekspor.
            'currency' => $this->resource->currencyCode(),
            'swiftCode' => $this->swift_code,
            'bankAddress' => $this->bank_address,
            'correspondentBank' => $this->correspondent_bank,
            'isActive' => $this->is_active,
            'sortOrder' => $this->sort_order,
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
