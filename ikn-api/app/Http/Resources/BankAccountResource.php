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
            'isActive' => $this->is_active,
            'sortOrder' => $this->sort_order,
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
