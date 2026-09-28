<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

// Detail laporan WBS untuk admin. Identitas pelapor hanya bila tidak anonim.
class WbsReportResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'subject' => $this->subject,
            'body' => $this->body,
            'isAnonymous' => $this->is_anonymous,
            'reporterName' => $this->is_anonymous ? null : $this->reporter_name,
            'reporterContact' => $this->is_anonymous ? null : $this->reporter_contact,
            'attachment' => $this->attachment ? $this->attachment->toSummary() : null,
            'status' => $this->status,
            'adminNotes' => $this->admin_notes,
            'handledBy' => $this->handler ? ['id' => $this->handler->id, 'name' => $this->handler->name] : null,
            'createdAt' => optional($this->created_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }
}
