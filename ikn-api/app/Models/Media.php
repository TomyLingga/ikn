<?php

namespace App\Models;

use Illuminate\Support\Facades\Storage;

class Media extends Model
{
    public const DISK_PUBLIC = 'public';
    public const DISK_PRIVATE = 'private';
    public const DISKS = [self::DISK_PUBLIC, self::DISK_PRIVATE];

    protected $table = 'media';

    protected $fillable = ['disk', 'path', 'original_name', 'mime', 'size', 'collection', 'meta', 'uploaded_by'];

    protected $casts = ['meta' => 'array', 'size' => 'integer'];

    public function isPublic(): bool
    {
        return $this->disk === self::DISK_PUBLIC;
    }

    public function isImage(): bool
    {
        return str_starts_with($this->mime, 'image/');
    }

    // URL publik untuk disk public; endpoint ber-Policy untuk disk private.
    public function url(): string
    {
        if ($this->isPublic()) {
            return Storage::disk(self::DISK_PUBLIC)->url($this->path);
        }

        return url('/api/v1/files/'.$this->id);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function toSummary(): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url(),
            'mime' => $this->mime,
            'size' => $this->size,
            'originalName' => $this->original_name,
        ];
    }
}
