<?php

namespace App\Services\Geo;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Google Maps Platform, Map Tiles API (2D tiles), ASUMSI A-98. Dokumen resmi:
 * https://developers.google.com/maps/documentation/tile/session_tokens dan .../tile/roadmap.
 *
 * Alurnya: server membuat token sesi (`POST /v1/createSession?key=`) per jenis peta, lalu browser mengambil tile
 * `/v1/2dtiles/{z}/{x}/{y}?session=&key=` langsung dari Google. Token berlaku sekitar dua minggu (`expiry`, detik
 * epoch) dan boleh dipakai banyak klien, jadi disimpan di cache sampai menjelang kedaluwarsa. Tile tidak pernah
 * lewat server ini dan tidak disimpan (kebijakan Google melarang caching di luar header Cache-Control).
 *
 * API key ikut di URL tile, jadi terlihat di browser: key wajib dibatasi "HTTP referrer" + hanya Map Tiles API.
 * Karena pembatasan itu, permintaan dari server ini membawa header Referer berisi alamat situs.
 */
class GoogleMapTilesClient
{
    public const LAYER_STREET = 'street';
    public const LAYER_SATELLITE = 'satellite';
    public const LAYER_HYBRID = 'hybrid';

    /** Jenis peta per lapisan; hybrid = citra satelit + nama jalan/tempat dalam satu tile. */
    private const SESSION_BODIES = [
        self::LAYER_STREET => ['mapType' => 'roadmap'],
        self::LAYER_SATELLITE => ['mapType' => 'satellite'],
        self::LAYER_HYBRID => ['mapType' => 'satellite', 'layerTypes' => ['layerRoadmap']],
    ];

    private const CACHE_PREFIX = 'maps:google:session:';

    public static function layers(): array
    {
        return array_keys(self::SESSION_BODIES);
    }

    /**
     * Token sesi untuk satu lapisan: ['session' => string, 'expiry' => int detik epoch].
     * `$fresh` melewati cache (tombol Uji) tetapi tetap menyimpan hasilnya.
     *
     * @throws MapProviderException
     */
    public function session(string $key, string $layer, bool $fresh = false): array
    {
        $margin = (int) config('ikn.maps.google.session_margin_seconds', 86400);
        $cacheKey = self::CACHE_PREFIX.$layer.':'.sha1($key.'|'.config('ikn.maps.google.language').'|'.config('ikn.maps.google.region'));

        if (! $fresh) {
            $cached = Cache::get($cacheKey);
            if (is_array($cached) && isset($cached['session'], $cached['expiry']) && $cached['expiry'] - $margin > time()) {
                return $cached;
            }
        }

        $session = $this->createSession($key, $layer);
        $ttl = $session['expiry'] - $margin - time();
        if ($ttl > 0) {
            Cache::put($cacheKey, $session, $ttl);
        }

        return $session;
    }

    /** @throws MapProviderException */
    public function createSession(string $key, string $layer): array
    {
        $body = (self::SESSION_BODIES[$layer] ?? self::SESSION_BODIES[self::LAYER_STREET]) + [
            'language' => (string) config('ikn.maps.google.language', 'id-ID'),
            'region' => (string) config('ikn.maps.google.region', 'ID'),
        ];

        try {
            $response = $this->http('application/json')
                ->timeout((int) config('ikn.maps.google.timeout', 10))
                ->post($this->baseUrl().'/v1/createSession?key='.rawurlencode($key), $body);
        } catch (Throwable $e) {
            throw new MapProviderException(__('maps.unreachable', ['host' => parse_url($this->baseUrl(), PHP_URL_HOST)]));
        }

        if ($response->failed()) {
            throw new MapProviderException($this->errorText($response, $key));
        }

        $session = $response->json('session');
        $expiry = $response->json('expiry');
        if (! is_string($session) || $session === '' || ! is_numeric($expiry)) {
            throw new MapProviderException(__('maps.google_bad_response'));
        }

        return ['session' => $session, 'expiry' => (int) $expiry];
    }

    public function tileTemplate(string $key, string $session): string
    {
        return $this->baseUrl().'/v1/2dtiles/{z}/{x}/{y}?session='.rawurlencode($session).'&key='.rawurlencode($key);
    }

    /** Endpoint info viewport: browser menambah zoom + batas peta dan menampilkan `copyright` dari jawabannya. */
    public function viewportUrl(string $key, string $session): string
    {
        return $this->baseUrl().'/tile/v1/viewport?session='.rawurlencode($session).'&key='.rawurlencode($key);
    }

    /**
     * Ambil satu tile zoom 0 untuk memastikan key juga diterima endpoint tile (dihitung satu permintaan tile).
     *
     * @throws MapProviderException
     */
    public function probeTile(string $key, string $session): void
    {
        $url = strtr($this->tileTemplate($key, $session), ['{z}' => '0', '{x}' => '0', '{y}' => '0']);

        try {
            $response = $this->http('image/*')->timeout((int) config('ikn.maps.probe_timeout', 8))->get($url);
        } catch (Throwable $e) {
            throw new MapProviderException(__('maps.unreachable', ['host' => parse_url($this->baseUrl(), PHP_URL_HOST)]));
        }

        if ($response->failed()) {
            throw new MapProviderException($this->errorText($response, $key));
        }
        if (! str_starts_with(strtolower((string) $response->header('Content-Type')), 'image/')) {
            throw new MapProviderException(__('maps.not_an_image'));
        }
    }

    private function http(string $accept)
    {
        return Http::withHeaders([
            'Accept' => $accept,
            'Referer' => rtrim((string) config('ikn.frontend_url'), '/').'/',
        ]);
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('ikn.maps.google.base_url', 'https://tile.googleapis.com'), '/');
    }

    /** Pesan galat Google ({ error: { message, status } }) tanpa API key. */
    private function errorText(Response $response, string $key): string
    {
        $message = $response->json('error.message');
        $status = $response->json('error.status');
        $text = is_string($message) && $message !== '' ? $message : 'HTTP '.$response->status();
        if (is_string($status) && $status !== '') {
            $text .= ' ('.$status.')';
        }

        return __('maps.google_rejected', ['reason' => mb_substr(str_replace($key, '***', $text), 0, 400)]);
    }
}
