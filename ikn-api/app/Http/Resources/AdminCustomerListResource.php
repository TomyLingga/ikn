<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

// Baris daftar GET /admin/customers (kontrak 11.4). Butuh with('profile') + withCount('addresses').
class AdminCustomerListResource extends JsonResource
{
    public function toArray($request): array
    {
        $profile = $this->profile;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $profile?->phone,
            'company' => $profile?->company,
            'status' => $this->status,
            'joinedAt' => optional($this->created_at)->toApiString(),
            'approvedAt' => optional($this->approved_at)->toApiString(),
            'rejectionReason' => $this->rejection_reason,
            'emailVerifiedAt' => optional($this->email_verified_at)->toApiString(),
            'lastLoginAt' => optional($this->last_login_at)->toApiString(),
            'addressesCount' => (int) ($this->addresses_count ?? 0),
        ];
    }
}
