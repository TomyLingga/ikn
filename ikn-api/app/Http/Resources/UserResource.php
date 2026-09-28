<?php

namespace App\Http\Resources;

use App\Services\Auth\ModuleAccess;
use Illuminate\Http\Resources\Json\JsonResource;

// Bentuk user untuk /auth/* (kontrak bagian 3). Admin: + permissions/modules (dipakai FE toAdminAccount);
// customer: + approvedAt, rejectionReason, profile { company, position, companyEmail, companyPhone, taxId, phone }.
class UserResource extends JsonResource
{
    public function toArray($request): array
    {
        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'status' => $this->status,
            'locale' => $this->locale ?: 'id',
            'emailVerifiedAt' => optional($this->email_verified_at)->toApiString(),
            'lastLoginAt' => optional($this->last_login_at)->toApiString(),
        ];

        if ($this->isAdmin()) {
            $data['permissions'] = $this->isSuperAdmin() ? ['*'] : app(ModuleAccess::class)->allowedFor($this->resource);
            $data['modules'] = app(ModuleAccess::class)->allowedFor($this->resource);
        }

        if ($this->isCustomer()) {
            $profile = $this->profile;

            $data['approvedAt'] = optional($this->approved_at)->toApiString();
            $data['rejectionReason'] = $this->rejection_reason;
            $data['profile'] = [
                'company' => $profile?->company,
                'position' => $profile?->position,
                'companyEmail' => $profile?->company_email,
                'companyPhone' => $profile?->company_phone,
                'taxId' => $profile?->tax_id,
                'phone' => $profile?->phone,
            ];
        }

        return $data;
    }
}
