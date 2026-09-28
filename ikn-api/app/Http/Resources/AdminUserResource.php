<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Resources\Json\JsonResource;

// Bentuk akun admin untuk manajemen user (kontrak 11.4).
class AdminUserResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'active' => $this->status === User::STATUS_ACTIVE,
            'permissions' => $this->isSuperAdmin() ? ['*'] : array_values($this->permissions ?? []),
            'lastLoginAt' => optional($this->last_login_at)->toApiString(),
            'createdAt' => optional($this->created_at)->toApiString(),
        ];
    }
}
