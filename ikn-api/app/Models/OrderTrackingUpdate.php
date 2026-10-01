<?php

namespace App\Models;

// Catatan perjalanan kiriman dari admin selama order berstatus shipped (ASUMSI A-70). Bukan transisi status.
class OrderTrackingUpdate extends Model
{
    protected $fillable = ['order_id', 'note', 'created_by'];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function toSummary(): array
    {
        return [
            'id' => $this->id,
            'note' => $this->note,
            'at' => optional($this->created_at)->toApiString(),
            'actor' => $this->relationLoaded('author') && $this->author
                ? ['id' => $this->author->id, 'name' => $this->author->name]
                : null,
        ];
    }
}
