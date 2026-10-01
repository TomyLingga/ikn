<?php

namespace App\Http\Resources;

use App\Models\Fee;
use Illuminate\Http\Resources\Json\JsonResource;

class FeeResource extends JsonResource
{
    /** Bentuk publik (GET /commerce/config): tanpa daftar customer sasaran. */
    public static function publicArray(Fee $fee): array
    {
        return [
            'id' => $fee->id,
            'name' => $fee->name,
            'type' => $fee->type,
            'amount' => $fee->amountInt(),
            'isActive' => $fee->is_active,
            'sortOrder' => $fee->sort_order,
        ];
    }

    /** Bentuk admin: + audience dan customers[] (butuh with('customers.profile')). */
    public function toArray($request): array
    {
        return self::publicArray($this->resource) + [
            'audience' => $this->audience ?: Fee::AUDIENCE_ALL,
            'customers' => $this->audienceCustomers(),
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
