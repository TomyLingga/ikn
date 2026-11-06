<?php

namespace App\Support;

/**
 * Bingkai media per pemakaian (ASUMSI A-93, 2026-11-05): titik fokus (x, y dalam persen), zoom (1-3), dan rentang
 * putar video (start/end dalam detik). Tidak mengubah berkas; FE menerapkannya sebagai object-position + scale dan
 * memutar video hanya di rentang itu. Bingkai bawaan (tengah, zoom 1, tanpa rentang) disimpan sebagai null.
 */
class MediaFrame
{
    public const ZOOM_MAX = 3;

    /** @return array{x: float, y: float, zoom: float, start: ?float, end: ?float}|null */
    public static function normalize($value): ?array
    {
        if (! is_array($value)) {
            return null;
        }
        $num = fn ($v, $min, $max, $default) => is_numeric($v) ? round(min($max, max($min, (float) $v)), 2) : $default;
        $frame = [
            'x' => $num($value['x'] ?? null, 0, 100, 50.0),
            'y' => $num($value['y'] ?? null, 0, 100, 50.0),
            'zoom' => $num($value['zoom'] ?? null, 1, self::ZOOM_MAX, 1.0),
            'start' => is_numeric($value['start'] ?? null) && $value['start'] > 0 ? round((float) $value['start'], 2) : null,
            'end' => is_numeric($value['end'] ?? null) && $value['end'] > 0 ? round((float) $value['end'], 2) : null,
        ];
        if ($frame['start'] !== null && $frame['end'] !== null && $frame['end'] <= $frame['start']) {
            $frame['end'] = null;
        }

        return self::isDefault($frame) ? null : $frame;
    }

    public static function isDefault(array $frame): bool
    {
        return (float) $frame['x'] === 50.0 && (float) $frame['y'] === 50.0 && (float) $frame['zoom'] === 1.0
            && $frame['start'] === null && $frame['end'] === null;
    }

    /** Aturan validasi untuk objek bingkai di bawah $path (nilai di luar rentang ditolak, bukan dipotong diam-diam). */
    public static function rules(string $path): array
    {
        return [
            $path => ['nullable', 'array'],
            "$path.x" => ['nullable', 'numeric', 'between:0,100'],
            "$path.y" => ['nullable', 'numeric', 'between:0,100'],
            "$path.zoom" => ['nullable', 'numeric', 'between:1,'.self::ZOOM_MAX],
            "$path.start" => ['nullable', 'numeric', 'min:0'],
            "$path.end" => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
