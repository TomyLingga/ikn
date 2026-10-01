<?php

namespace App\Services\Media;

use App\Exceptions\ApiException;
use App\Models\Media;
use App\Models\PageSection;
use App\Models\User;
use App\Services\Cms\SectionRegistry;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

// Satu pintu unggah/hapus berkas (ASUMSI A-14): validasi mime asli, nama acak, disk public/private.
class MediaService
{
    public const KIND_IMAGE = 'image';
    public const KIND_DOCUMENT = 'document';

    public function __construct(private SectionRegistry $registry)
    {
    }

    /**
     * @param  string[]|null  $allowedMimes  null = gambar + dokumen dari config
     */
    public function upload(
        UploadedFile $file,
        string $collection = 'general',
        string $disk = Media::DISK_PUBLIC,
        ?User $user = null,
        ?array $allowedMimes = null,
        ?int $maxKb = null,
    ): Media {
        if (! $file->isValid()) {
            throw new ApiException(422, 'VALIDATION_ERROR', __('validation.uploaded', ['attribute' => 'file']));
        }

        $mime = (string) $file->getMimeType(); // deteksi finfo, bukan ekstensi klien
        $imageMimes = config('ikn.media.image_mimes', []);
        $documentMimes = config('ikn.media.document_mimes', []);
        $videoMimes = config('ikn.media.video_mimes', []);
        $allowed = $allowedMimes ?? array_merge($imageMimes, $documentMimes, $videoMimes);

        if (! in_array($mime, $allowed, true)) {
            throw ApiException::unsupportedMedia();
        }

        $isImage = in_array($mime, $imageMimes, true);
        $isVideo = in_array($mime, $videoMimes, true);
        $limitKb = $maxKb ?? ($isImage
            ? config('ikn.media.image_max_kb')
            : ($isVideo ? config('ikn.media.video_max_kb') : config('ikn.media.document_max_kb')));

        if ($file->getSize() > $limitKb * 1024) {
            throw ApiException::tooLarge();
        }

        $collection = Str::slug($collection) ?: 'general';
        $extension = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension() ?: 'bin');
        $path = sprintf('%s/%s/%s.%s', $collection, now()->format('Y/m'), Str::random(40), $extension);

        Storage::disk($disk)->putFileAs(dirname($path), $file, basename($path));

        $meta = [];
        if ($isImage && $mime !== 'image/svg+xml') {
            $size = @getimagesize($file->getRealPath());
            if ($size) {
                $meta = ['width' => $size[0], 'height' => $size[1]];
            }
        }

        return Media::create([
            'disk' => $disk,
            'path' => $path,
            'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'mime' => $mime,
            'size' => $file->getSize(),
            'collection' => $collection,
            'meta' => $meta ?: null,
            'uploaded_by' => $user?->id,
        ]);
    }

    /** Simpan berkas dari path lokal (dipakai seeder), tanpa validasi ukuran. */
    public function importFromPath(string $sourcePath, string $collection, string $disk = Media::DISK_PUBLIC, ?string $originalName = null): Media
    {
        $mime = mime_content_type($sourcePath) ?: 'application/octet-stream';
        $extension = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION) ?: 'bin');
        $path = sprintf('%s/seed/%s.%s', Str::slug($collection), Str::random(24), $extension);

        Storage::disk($disk)->put($path, file_get_contents($sourcePath));

        $meta = [];
        if (str_starts_with($mime, 'image/') && $mime !== 'image/svg+xml') {
            $size = @getimagesize($sourcePath);
            if ($size) {
                $meta = ['width' => $size[0], 'height' => $size[1]];
            }
        }

        return Media::create([
            'disk' => $disk,
            'path' => $path,
            'original_name' => $originalName ?? basename($sourcePath),
            'mime' => $mime,
            'size' => filesize($sourcePath),
            'collection' => $collection,
            'meta' => $meta ?: null,
        ]);
    }

    /** Hapus berkas; ditolak (409 MEDIA_IN_USE) bila masih dirujuk konten. */
    public function delete(Media $media): void
    {
        if ($this->isReferenced($media)) {
            throw ApiException::conflict('MEDIA_IN_USE', __('api.media_in_use'));
        }

        Storage::disk($media->disk)->delete($media->path);
        $media->delete();
    }

    /**
     * Media masih dipakai entitas lain? Daftar tabel/kolom ada di config/media_references.php
     * (tiap area menambahkan barisnya sendiri); tabel yang belum ada dilewati.
     */
    public function isReferenced(Media $media): bool
    {
        foreach (config('media_references.columns', []) as [$table, $column]) {
            if ($this->tableExists($table) && DB::table($table)->where($column, $media->id)->exists()) {
                return true;
            }
        }

        // Id media yang disimpan di dalam kolom jsonb (mis. payment_methods.config.qrisMediaId).
        foreach (config('media_references.json_id_columns', []) as [$table, $column, $key]) {
            if ($this->tableExists($table)
                && DB::table($table)->whereRaw("($column->>?) = ?", [$key, (string) $media->id])->exists()) {
                return true;
            }
        }

        foreach (config('media_references.json_array_id_columns', []) as [$table, $column, $key]) {
            if ($this->tableExists($table)
                && DB::table($table)->whereRaw("jsonb_typeof($column) = 'array' AND $column @> ?::jsonb", [json_encode([[$key => (int) $media->id]])])->exists()) {
                return true;
            }
        }

        // Gambar yang disisipkan di HTML/JSON (isi berita, section, config metode bayar) dirujuk lewat path-nya.
        $needle = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $media->path).'%';
        foreach (config('media_references.text_columns', []) as [$table, $column]) {
            if ($this->tableExists($table) && DB::table($table)->whereRaw("$column::text ILIKE ?", [$needle])->exists()) {
                return true;
            }
        }

        // Rujukan id media di dalam konten section (jsonb) dicek lewat registry.
        foreach (PageSection::select(['type', 'content'])->cursor() as $section) {
            if (in_array($media->id, $this->registry->collectMediaIds($section->type, $section->content ?? []), true)) {
                return true;
            }
        }

        return false;
    }

    private function tableExists(string $table): bool
    {
        static $cache = [];

        return $cache[$table] ??= Schema::hasTable($table);
    }
}
