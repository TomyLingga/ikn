<?php

namespace App\Http\Resources;

use App\Models\CustomerAddress;
use Illuminate\Http\Resources\Json\JsonResource;

// GET /customer/profile: profil (kompatibel CustomerProfile FE) + addresses[]. Resource dari model User.
class CustomerProfileResource extends JsonResource
{
    public function toArray($request): array
    {
        $this->resource->loadMissing(array_merge(
            ['profile'],
            array_map(fn (string $relation) => 'addresses.'.$relation, CustomerAddress::REGION_RELATIONS)
        ));
        $profile = $this->profile;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'status' => $this->status,
            'locale' => $this->locale,
            'emailVerifiedAt' => optional($this->email_verified_at)->toApiString(),
            'approvedAt' => optional($this->approved_at)->toApiString(),
            'rejectionReason' => $this->rejection_reason,
            'phone' => $profile?->phone,
            'company' => $profile?->company,
            'position' => $profile?->position,
            'companyEmail' => $profile?->company_email,
            'companyPhone' => $profile?->company_phone,
            'taxId' => $profile?->tax_id,
            // Pasar dikunci admin (ASUMSI A-86); negara + alamat perusahaan hanya bisa diubah customer selagi pending.
            'market' => $this->resource->market(),
            'currency' => $this->resource->currency(),
            'countryCode' => $profile?->country_code ?: \App\Models\CustomerProfile::DEFAULT_COUNTRY,
            'companyAddress' => $profile?->company_address,
            'addresses' => CustomerAddressResource::collection($this->addresses),
            'createdAt' => optional($this->created_at)->toApiString(),
        ];
    }
}
