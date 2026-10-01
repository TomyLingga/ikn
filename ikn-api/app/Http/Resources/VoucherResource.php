<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Resources\Json\JsonResource;

class VoucherResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'type' => $this->type,
            'value' => $this->valueNumber(),
            'minSubtotal' => $this->minSubtotalInt(),
            'maxDiscount' => $this->maxDiscountInt(),
            'quota' => $this->quota,
            'usedCount' => (int) $this->used_count,
            'perUserLimit' => $this->per_user_limit,
            'scope' => $this->discountScope(),
            'categoryIds' => $this->discountCategoryIds(),
            'startsAt' => optional($this->starts_at)->toApiString(),
            'endsAt' => optional($this->ends_at)->toApiString(),
            'isActive' => $this->is_active,
            'audience' => $this->audience ?: \App\Models\Voucher::AUDIENCE_ALL,
            'customers' => $this->audienceCustomers(),
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
