<?php

namespace App\Models;

use Illuminate\Support\Facades\Storage;

class Media extends Model
{
    public const DISK_PUBLIC = 'public';
    public const DISK_PRIVATE = 'private';
    /** Media dari URL (A-92): tanpa berkas; meta {provider, url, embedUrl, thumbnailUrl, sourceUrl}. */
    public const DISK_EXTERNAL = 'external';
    public const DISKS = [self::DISK_PUBLIC, self::DISK_PRIVATE];
    /** Disk yang tampil di media library dan boleh dirujuk konten publik. */
    public const LIBRARY_DISKS = [self::DISK_PUBLIC, self::DISK_EXTERNAL];

    protected $table = 'media';

    protected $fillable = ['disk', 'path', 'original_name', 'mime', 'size', 'collection', 'meta', 'uploaded_by'];

    protected $casts = ['meta' => 'array', 'size' => 'integer'];

    public function isPublic(): bool
    {
        return in_array($this->disk, self::LIBRARY_DISKS, true);
    }

    public function isExternal(): bool
    {
        return $this->disk === self::DISK_EXTERNAL;
    }

    public function isImage(): bool
    {
        return str_starts_with($this->mime, 'image/');
    }

    public function isVideo(): bool
    {
        return str_starts_with($this->mime, 'video/');
    }

    // URL publik untuk disk public; endpoint ber-Policy untuk disk private.
    public function url(): string
    {
        if ($this->isExternal()) {
            return (string) ($this->meta['url'] ?? '');
        }
        if ($this->disk === self::DISK_PUBLIC) {
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
        ] + $this->externalSummary();
    }

    /** Field tambahan media dari URL: penyedia, URL embed (pemutar YouTube/Vimeo/Drive), dan gambar pratinjau. */
    public function externalSummary(): array
    {
        if (! $this->isExternal()) {
            return [];
        }

        return [
            'provider' => $this->meta['provider'] ?? 'url',
            'embedUrl' => $this->meta['embedUrl'] ?? null,
            'thumbnailUrl' => $this->meta['thumbnailUrl'] ?? null,
            'sourceUrl' => $this->meta['sourceUrl'] ?? null,
        ];
    }
}
