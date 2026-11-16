<?php

namespace App\Support;

/**
 * Templat URL tile XYZ dari penyedia peta pilihan admin (ASUMSI A-98), mis.
 * `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=...`.
 *
 * Wajib https dan memuat {z}, {x}, {y}; boleh memuat {s} (subdomain a/b/c) dan {r} (akhiran layar retina).
 * Placeholder lain ditolak karena Leaflet tidak mengisinya. Host harus nama domain publik: URL ini diambil
 * server saat tombol "Uji" ditekan, jadi alamat lokal/privat ditolak.
 */
class TileUrlTemplate
{
    public const MAX_LENGTH = 500;

    public const SUBDOMAINS = 'abc';

    private const PLACEHOLDERS = ['z', 'x', 'y', 's', 'r'];

    public static function isValid(string $template): bool
    {
        if ($template === '' || strlen($template) > self::MAX_LENGTH) {
            return false;
        }
        if (! str_starts_with($template, 'https://') || preg_match('/[\s<>"\'`\\\\]/', $template)) {
            return false;
        }

        preg_match_all('/\{([^{}]*)\}/', $template, $matches);
        $used = $matches[1];
        if (array_diff($used, self::PLACEHOLDERS) || array_diff(['z', 'x', 'y'], $used)) {
            return false;
        }
        // Kurung kurawal tanpa pasangan.
        if (preg_match('/[{}]/', preg_replace('/\{[^{}]*\}/', '', $template))) {
            return false;
        }

        $host = parse_url(self::fill($template, 0, 0, 0), PHP_URL_HOST);

        return is_string($host) && self::isPublicHost($host);
    }

    /** URL satu tile; {s} = subdomain pertama, {r} dikosongkan. */
    public static function fill(string $template, int $z, int $x, int $y): string
    {
        return strtr($template, ['{z}' => (string) $z, '{x}' => (string) $x, '{y}' => (string) $y, '{s}' => self::SUBDOMAINS[0], '{r}' => '']);
    }

    public static function hasSubdomains(string $template): bool
    {
        return str_contains($template, '{s}');
    }

    private static function isPublicHost(string $host): bool
    {
        $host = strtolower(trim($host, '[]'));
        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
        }
        // Bentuk IPv4 tidak baku (127.1, 0x7f.0.0.1, 0177.0.0.1) lolos FILTER_VALIDATE_IP tetapi tetap dibaca
        // curl sebagai alamat IP. Nama domain publik tidak pernah berakhir dengan label angka.
        $labels = explode('.', $host);
        if (preg_match('/^(0x[0-9a-f]*|[0-9]+)$/', (string) end($labels))) {
            return false;
        }

        return str_contains($host, '.')
            && ! preg_match('/(^|\.)(localhost|local|internal|lan|home|test|invalid)$/', $host)
            && (bool) preg_match('/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/', $host);
    }
}
