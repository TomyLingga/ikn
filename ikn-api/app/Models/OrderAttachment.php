<?php

namespace App\Models;

// Lampiran order dari admin (faktur pajak, surat jalan, dsb.), berkas di disk private (ASUMSI A-74).
class OrderAttachment extends Model
{
    protected $fillable = ['order_id', 'media_id', 'label', 'created_by'];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function toSummary(): array
    {
        $media = $this->relationLoaded('media') ? $this->media : $this->media()->first();

        return [
            'id' => $this->id,
            'label' => $this->label ?: ($media->original_name ?? null),
            'file' => $media ? [
                'mediaId' => $media->id,
                'url' => $media->url(),
                'originalName' => $media->original_name,
                'mime' => $media->mime,
                'size' => (int) $media->size,
            ] : null,
            'at' => optional($this->created_at)->toApiString(),
            'actor' => $this->relationLoaded('author') && $this->author ? ['id' => $this->author->id, 'name' => $this->author->name] : null,
        ];
    }
}
