<?php

namespace App\Services\Media;

use Illuminate\Validation\ValidationException;

/**
 * Media dari URL (ASUMSI A-92, 2026-11-05): foto/video yang tidak diunggah, cukup ditautkan. Mengenali YouTube, Vimeo,
 * Google Drive, dan URL langsung berkas gambar/video; hasilnya mime + meta {provider, url, embedUrl, thumbnailUrl,
 * sourceUrl} yang disimpan di baris media berdisk `external` (tanpa berkas).
 */
class ExternalMedia
{
    public const KINDS = ['auto', 'image', 'video'];

    private const IMAGE_EXT = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif', 'avif' => 'image/avif', 'svg' => 'image/svg+xml'];

    private const VIDEO_EXT = ['mp4' => 'video/mp4', 'webm' => 'video/webm', 'ogv' => 'video/ogg', 'mov' => 'video/quicktime'];

    /** @return array{mime: string, name: string, meta: array<string, string|null>} */
    public static function resolve(string $url, string $kind = 'auto'): array
    {
        $url = trim($url);
        $parts = parse_url($url);
        $host = strtolower(preg_replace('/^www\./', '', $parts['host'] ?? ''));
        $path = $parts['path'] ?? '';
        parse_str($parts['query'] ?? '', $query);
        if (! in_array($parts['scheme'] ?? '', ['http', 'https'], true) || $host === '') {
            throw self::invalid(__('api.media_url_invalid'));
        }

        // YouTube: watch?v=, youtu.be/ID, /embed/ID, /shorts/ID, /live/ID.
        if (in_array($host, ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'], true)) {
            $id = $host === 'youtu.be' ? ltrim($path, '/') : ($query['v'] ?? (preg_match('#/(?:embed|shorts|live|v)/([^/?]+)#', $path, $m) ? $m[1] : ''));
            if (! preg_match('/^[A-Za-z0-9_-]{11}$/', (string) $id)) {
                throw self::invalid(__('api.media_url_youtube'));
            }
            self::expect($kind, 'video');

            return self::make('video/youtube', 'YouTube '.$id, 'youtube', $url, [
                'url' => 'https://www.youtube.com/watch?v='.$id,
                'embedUrl' => 'https://www.youtube-nocookie.com/embed/'.$id,
                'thumbnailUrl' => 'https://i.ytimg.com/vi/'.$id.'/hqdefault.jpg',
            ]);
        }

        // Vimeo: vimeo.com/123456 atau player.vimeo.com/video/123456.
        if (in_array($host, ['vimeo.com', 'player.vimeo.com'], true)) {
            if (! preg_match('#/(?:video/)?(\d{6,})#', $path, $m)) {
                throw self::invalid(__('api.media_url_invalid'));
            }
            self::expect($kind, 'video');

            return self::make('video/vimeo', 'Vimeo '.$m[1], 'vimeo', $url, [
                'url' => 'https://vimeo.com/'.$m[1],
                'embedUrl' => 'https://player.vimeo.com/video/'.$m[1],
                'thumbnailUrl' => null,
            ]);
        }

        // Google Drive: /file/d/ID/..., open?id=ID, uc?id=ID. Berkas harus dibagikan "Siapa saja yang memiliki link".
        if (in_array($host, ['drive.google.com', 'docs.google.com'], true)) {
            $id = preg_match('#/d/([A-Za-z0-9_-]{10,})#', $path, $m) ? $m[1] : ($query['id'] ?? '');
            if (! preg_match('/^[A-Za-z0-9_-]{10,}$/', (string) $id)) {
                throw self::invalid(__('api.media_url_drive'));
            }
            $thumb = 'https://drive.google.com/thumbnail?id='.$id.'&sz=w1600';
            if ($kind === 'video') {
                return self::make('video/x-gdrive', 'Google Drive '.$id, 'gdrive', $url, [
                    'url' => 'https://drive.google.com/file/d/'.$id.'/view',
                    'embedUrl' => 'https://drive.google.com/file/d/'.$id.'/preview',
                    'thumbnailUrl' => $thumb,
                ]);
            }

            // Gambar (bawaan untuk Drive): tautan gambar langsung yang bisa dipakai <img>.
            return self::make('image/x-gdrive', 'Google Drive '.$id, 'gdrive', $url, [
                'url' => 'https://lh3.googleusercontent.com/d/'.$id,
                'embedUrl' => null,
                'thumbnailUrl' => $thumb,
            ]);
        }

        // URL langsung: jenis dari ekstensi berkas, atau dari pilihan admin bila tanpa ekstensi.
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $name = basename($path) ?: $host;
        if (isset(self::IMAGE_EXT[$ext]) && $kind !== 'video') {
            return self::make(self::IMAGE_EXT[$ext], $name, 'url', $url, ['url' => $url, 'embedUrl' => null, 'thumbnailUrl' => $url]);
        }
        if (isset(self::VIDEO_EXT[$ext]) && $kind !== 'image') {
            return self::make(self::VIDEO_EXT[$ext], $name, 'url', $url, ['url' => $url, 'embedUrl' => null, 'thumbnailUrl' => null]);
        }
        if ($kind === 'image' || $kind === 'video') {
            return self::make($kind.'/x-url', $name, 'url', $url, ['url' => $url, 'embedUrl' => null, 'thumbnailUrl' => $kind === 'image' ? $url : null]);
        }

        throw self::invalid(__('api.media_url_kind'));
    }

    private static function expect(string $kind, string $actual): void
    {
        if ($kind !== 'auto' && $kind !== $actual) {
            throw self::invalid(__('api.media_url_kind_mismatch'));
        }
    }

    private static function make(string $mime, string $name, string $provider, string $source, array $meta): array
    {
        return ['mime' => $mime, 'name' => $name, 'meta' => ['provider' => $provider, 'sourceUrl' => $source] + $meta];
    }

    private static function invalid(string $message): ValidationException
    {
        return ValidationException::withMessages(['url' => [$message]]);
    }
}
