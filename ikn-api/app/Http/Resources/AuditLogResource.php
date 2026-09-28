<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

// Baris GET /admin/audit-logs (super_admin): aksi admin + nama user. Butuh with('user').
class AuditLogResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'subjectType' => $this->subject_type,
            'subjectId' => $this->subject_id,
            'user' => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email, 'role' => $this->user->role] : null,
            'before' => $this->before,
            'after' => $this->after,
            'ip' => $this->ip,
            'userAgent' => $this->user_agent,
            'createdAt' => optional($this->created_at)->toApiString(),
        ];
    }
}
