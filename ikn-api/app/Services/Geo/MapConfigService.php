<?php

namespace App\Services\Geo;

use App\Services\Cms\SettingsService;
use App\Support\TileUrlTemplate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Lapisan tile untuk semua peta Leaflet di FE (ASUMSI A-98). Penyedia dipilih admin (settings grup `maps`):
 * default = OSM + Esri tanpa key, google = Map Tiles API dengan token sesi, custom = templat XYZ apa pun.
 *
 * FE hanya membaca hasil `config()` (GET /geo/map-config) dan tidak perlu tahu penyedia mana yang aktif.
 * Penyedia yang gagal tidak pernah menghasilkan peta kosong: lapisan bawaan disajikan dengan `fallback: true`.
 */
class MapConfigService
{
    public const CACHE_KEY = 'maps:config:v1';

    public const PROVIDER_DEFAULT = 'default';
    public const PROVIDER_GOOGLE = 'google';
    public const PROVIDER_CUSTOM = 'custom';

    public function __construct(private SettingsService $settings, private GoogleMapTilesClient $google)
    {
    }

    /** Dipanggil setiap pengaturan grup maps disimpan. */
    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /** Konfigurasi publik (di-cache). */
    public function config(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached) && isset($cached['layers'])) {
            return $cached;
        }

        [$config, $ttl] = $this->resolve($this->stored());
        Cache::put(self::CACHE_KEY, $config, max(60, $ttl));

        return $config;
    }

    /**
     * Uji penyedia memakai isian form (belum disimpan) atau pengaturan tersimpan. Tidak menulis pengaturan dan
     * tidak menyentuh cache konfigurasi publik. Hasil: { provider, ok, results[{layer, ok, message}], config }.
     */
    public function test(?array $override = null): array
    {
        $settings = $this->stored();
        foreach ($override ?? [] as $name => $value) {
            if (! array_key_exists($name, $settings) || $value === null) {
                continue;
            }
            if ($name === 'google_api_key' && $value === SettingsService::SECRET_MASK) {
                continue; // mask = pakai key tersimpan
            }
            $settings[$name] = $name === 'custom_max_zoom' ? (int) $value : trim((string) $value);
        }

        if ($settings['provider'] === self::PROVIDER_GOOGLE) {
            $results = $this->testGoogle($settings['google_api_key']);
        } elseif ($settings['provider'] === self::PROVIDER_CUSTOM) {
            $results = $this->testCustom($settings);
        } else {
            $results = [
                ['layer' => 'street', 'ok' => true, 'message' => __('maps.default_ok', ['name' => 'OpenStreetMap'])],
                ['layer' => 'satellite', 'ok' => true, 'message' => __('maps.default_ok', ['name' => 'Esri World Imagery'])],
            ];
        }

        $ok = ! in_array(false, array_column($results, 'ok'), true);
        // Pratinjau memakai lapisan yang benar-benar akan disajikan; sesi Google hasil uji sudah ada di cache sesi.
        [$config] = $ok ? $this->resolve($settings, false) : [$this->fallback($settings['provider'])];

        return ['provider' => $settings['provider'], 'ok' => $ok, 'results' => $results, 'config' => $config];
    }

    /** Pengaturan tersimpan grup maps (key Google sudah didekripsi). */
    private function stored(): array
    {
        return [
            'provider' => (string) ($this->settings->get('maps.provider') ?: self::PROVIDER_DEFAULT),
            'google_api_key' => trim($this->settings->secret('maps.google_api_key')),
            'custom_street_url' => trim((string) $this->settings->get('maps.custom_street_url')),
            'custom_satellite_url' => trim((string) $this->settings->get('maps.custom_satellite_url')),
            'custom_attribution' => trim((string) $this->settings->get('maps.custom_attribution')),
            'custom_max_zoom' => (int) ($this->settings->get('maps.custom_max_zoom') ?: 19),
        ];
    }

    /** @return array{0: array, 1: int} konfigurasi + lama cache (detik) */
    private function resolve(array $settings, bool $log = true): array
    {
        $ttl = (int) config('ikn.maps.config_cache_seconds', 21600);

        if ($settings['provider'] === self::PROVIDER_CUSTOM) {
            return [$this->customConfig($settings), $ttl];
        }
        if ($settings['provider'] !== self::PROVIDER_GOOGLE) {
            return [$this->payload(self::PROVIDER_DEFAULT, false, $this->defaultLayers()), $ttl];
        }

        try {
            if ($settings['google_api_key'] === '') {
                throw new MapProviderException(__('maps.google_key_missing'));
            }
            $layers = [];
            $expiry = PHP_INT_MAX;
            foreach (GoogleMapTilesClient::layers() as $layer) {
                $session = $this->google->session($settings['google_api_key'], $layer);
                $layers[$layer] = $this->googleLayer($settings['google_api_key'], $session['session'], $layer);
                $expiry = min($expiry, $session['expiry']);
            }
        } catch (Throwable $e) {
            if ($log) {
                // Pesan MapProviderException sudah bersih dari API key; galat lain hanya dicatat kelasnya.
                Log::warning('maps: Google tiles unavailable, serving default tiles: '.($e instanceof MapProviderException ? $e->getMessage() : get_class($e)));
            }

            return [$this->fallback(self::PROVIDER_GOOGLE), (int) config('ikn.maps.fallback_cache_seconds', 300)];
        }

        // Konfigurasi tidak boleh hidup lebih lama daripada token sesinya.
        $remaining = $expiry - (int) config('ikn.maps.google.session_margin_seconds', 86400) - time();

        return [
            $this->payload(self::PROVIDER_GOOGLE, false, [
                'street' => $layers['street'],
                'satellite' => $layers['satellite'],
                'satelliteLabels' => null,
                'hybrid' => $layers['hybrid'],
            ]),
            max(60, min($ttl, $remaining)),
        ];
    }

    private function fallback(string $provider): array
    {
        return $this->payload($provider, $provider !== self::PROVIDER_DEFAULT, $this->defaultLayers());
    }

    private function payload(string $provider, bool $fallback, array $layers): array
    {
        return ['provider' => $provider, 'fallback' => $fallback, 'layers' => $layers];
    }

    private function defaultLayers(): array
    {
        $layer = fn (string $name) => $this->layer(
            (string) config("ikn.maps.default.{$name}.url"),
            (string) config("ikn.maps.default.{$name}.attribution"),
            (int) config("ikn.maps.default.{$name}.max_zoom", 19),
        );

        return [
            'street' => $layer('street'),
            'satellite' => $layer('satellite'),
            'satelliteLabels' => $layer('satellite_labels'),
            'hybrid' => null,
        ];
    }

    /** URL kosong = lapisan bawaan untuk jenis itu; label Esri hanya menemani citra bawaan. */
    private function customConfig(array $settings): array
    {
        $default = $this->defaultLayers();
        $attribution = e($settings['custom_attribution']); // teks polos dari admin, Leaflet memasangnya sebagai HTML
        $maxZoom = min(22, max(1, (int) $settings['custom_max_zoom']));
        $custom = fn (string $url) => $this->layer($url, $attribution, $maxZoom, TileUrlTemplate::hasSubdomains($url) ? TileUrlTemplate::SUBDOMAINS : null, null, null, $attribution !== '');

        $street = TileUrlTemplate::isValid($settings['custom_street_url']) ? $custom($settings['custom_street_url']) : null;
        $satellite = TileUrlTemplate::isValid($settings['custom_satellite_url']) ? $custom($settings['custom_satellite_url']) : null;

        return $this->payload(self::PROVIDER_CUSTOM, ! $street && ! $satellite, [
            'street' => $street ?? $default['street'],
            'satellite' => $satellite ?? $default['satellite'],
            'satelliteLabels' => $satellite ? null : $default['satelliteLabels'],
            'hybrid' => null,
        ]);
    }

    private function googleLayer(string $key, string $session, string $layer): array
    {
        return $this->layer(
            $this->google->tileTemplate($key, $session),
            'Map data &copy; Google', // diganti FE dengan `copyright` dari attributionUrl untuk area yang tampil
            (int) config("ikn.maps.google.max_zoom.{$layer}", 19),
            null,
            'google',
            $this->google->viewportUrl($key, $session),
            true,
        );
    }

    /**
     * Satu lapisan tile siap pakai untuk Leaflet. `brand` = merek yang wajib ditampilkan di atas peta
     * (google = logo Google Maps); `attributionUrl` = endpoint yang mengembalikan { copyright } untuk viewport;
     * `attributionRequired` = atribusi wajib tampil juga di peta kecil yang biasanya tanpa atribusi (footer, beranda).
     */
    private function layer(string $url, string $attribution, int $maxZoom, ?string $subdomains = null, ?string $brand = null, ?string $attributionUrl = null, bool $attributionRequired = false): array
    {
        return [
            'url' => $url,
            'attribution' => $attribution,
            'maxZoom' => $maxZoom,
            'subdomains' => $subdomains,
            'brand' => $brand,
            'attributionUrl' => $attributionUrl,
            'attributionRequired' => $attributionRequired,
        ];
    }

    private function testGoogle(string $key): array
    {
        if ($key === '') {
            return [['layer' => 'street', 'ok' => false, 'message' => __('maps.google_key_missing')]];
        }

        $results = [];
        foreach (GoogleMapTilesClient::layers() as $layer) {
            try {
                $session = $this->google->session($key, $layer, true);
                $this->google->probeTile($key, $session['session']);
                $results[] = ['layer' => $layer, 'ok' => true, 'message' => __('maps.google_ok', ['until' => date('Y-m-d', $session['expiry'])])];
            } catch (MapProviderException $e) {
                $results[] = ['layer' => $layer, 'ok' => false, 'message' => $e->getMessage()];
            }
        }

        return $results;
    }

    private function testCustom(array $settings): array
    {
        $results = [];
        foreach (['street' => 'custom_street_url', 'satellite' => 'custom_satellite_url'] as $layer => $name) {
            $url = $settings[$name];
            if ($url === '') {
                $results[] = ['layer' => $layer, 'ok' => true, 'message' => __('maps.custom_blank')];
                continue;
            }
            $results[] = ['layer' => $layer] + $this->probe($url);
        }
        if ($settings['custom_street_url'] === '' && $settings['custom_satellite_url'] === '') {
            return [['layer' => 'street', 'ok' => false, 'message' => __('maps.custom_required')]];
        }

        return $results;
    }

    /** Ambil satu tile zoom rendah (z=1, x=1, y=0) dari templat custom. */
    private function probe(string $template): array
    {
        if (! TileUrlTemplate::isValid($template)) {
            return ['ok' => false, 'message' => __('maps.tile_url_invalid', ['attribute' => 'URL'])];
        }
        $host = (string) parse_url(TileUrlTemplate::fill($template, 1, 1, 0), PHP_URL_HOST);

        try {
            $response = Http::withHeaders([
                'Accept' => 'image/*',
                'User-Agent' => (string) config('ikn.nominatim.user_agent'),
                'Referer' => rtrim((string) config('ikn.frontend_url'), '/').'/',
            ])->timeout((int) config('ikn.maps.probe_timeout', 8))->withoutRedirecting()->get(TileUrlTemplate::fill($template, 1, 1, 0));
        } catch (Throwable $e) {
            return ['ok' => false, 'message' => __('maps.unreachable', ['host' => $host])];
        }

        if ($response->failed() || $response->redirect()) {
            return ['ok' => false, 'message' => __('maps.custom_rejected', ['host' => $host, 'status' => $response->status()])];
        }
        if (! str_starts_with(strtolower((string) $response->header('Content-Type')), 'image/')) {
            return ['ok' => false, 'message' => __('maps.not_an_image')];
        }

        return ['ok' => true, 'message' => __('maps.custom_ok', ['host' => $host])];
    }
}
