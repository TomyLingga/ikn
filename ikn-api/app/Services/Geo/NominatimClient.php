<?php

namespace App\Services\Geo;

use App\Exceptions\ApiException;
use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

// Proxy Nominatim (OSM): cache 7/30 hari, maksimum 1 request/detik ke upstream (kebijakan Nominatim),
// User-Agent jelas dari config ikn.nominatim. Hasil dinormalisasi ke bentuk kontrak bagian 5.
class NominatimClient
{
    public const UPSTREAM_MIN_INTERVAL_SECONDS = 1.0;

    private const CACHE_PREFIX = 'geo:';

    private const LOCK_KEY = 'geo:nominatim:lock';

    private const LAST_CALL_KEY = 'geo:nominatim:last';

    /** @return array<int, array<string, mixed>> */
    public function search(string $query): array
    {
        $query = trim($query);
        $key = self::CACHE_PREFIX.'search:'.sha1(mb_strtolower($query));
        $ttl = now()->addDays((int) config('ikn.nominatim.search_cache_days', 7));

        return Cache::remember($key, $ttl, fn () => $this->fetch('search', ['q' => $query]));
    }

    /** @return array<int, array<string, mixed>> */
    public function reverse(float $lat, float $lng): array
    {
        $key = self::CACHE_PREFIX.'reverse:'.sha1(sprintf('%.5f,%.5f', $lat, $lng));
        $ttl = now()->addDays((int) config('ikn.nominatim.reverse_cache_days', 30));

        return Cache::remember($key, $ttl, fn () => $this->fetch('reverse', ['lat' => $lat, 'lon' => $lng]));
    }

    /** @return array<int, array<string, mixed>> */
    private function fetch(string $endpoint, array $params): array
    {
        $this->throttleUpstream();

        $url = rtrim((string) config('ikn.nominatim.base_url'), '/').'/'.$endpoint;
        $query = $params + ['format' => 'jsonv2', 'countrycodes' => 'id', 'limit' => 5, 'addressdetails' => 1];

        try {
            $response = Http::withHeaders([
                'User-Agent' => (string) config('ikn.nominatim.user_agent'),
                'Accept' => 'application/json',
            ])->timeout(10)->get($url, $query);
        } catch (ConnectionException $e) {
            throw $this->upstreamError();
        }

        if ($response->failed()) {
            throw $this->upstreamError();
        }

        $json = $response->json();

        if (! is_array($json)) {
            throw $this->upstreamError();
        }

        if ($endpoint === 'reverse') {
            // reverse mengembalikan satu objek, atau { error: "Unable to geocode" } bila tidak ada hasil.
            $json = isset($json['error']) || ! isset($json['lat']) ? [] : [$json];
        }

        $items = [];
        foreach ($json as $item) {
            if (is_array($item) && isset($item['lat'], $item['lon'])) {
                $items[] = $this->normalize($item);
            }
        }

        return $items;
    }

    /** Bentuk kontrak: { displayName, lat, lng, address { road, village, district, city, state, postcode } }. */
    private function normalize(array $item): array
    {
        $address = is_array($item['address'] ?? null) ? $item['address'] : [];

        return [
            'displayName' => (string) ($item['display_name'] ?? ''),
            'lat' => (float) $item['lat'],
            'lng' => (float) $item['lon'],
            'address' => [
                'road' => $this->first($address, ['road', 'pedestrian', 'footway', 'residential']),
                'village' => $this->first($address, ['village', 'neighbourhood', 'hamlet', 'quarter', 'suburb']),
                'district' => $this->first($address, ['city_district', 'district', 'suburb', 'municipality', 'town']),
                'city' => $this->first($address, ['city', 'county', 'regency', 'town', 'state_district']),
                'state' => $this->first($address, ['state', 'province', 'region']),
                'postcode' => $this->first($address, ['postcode']),
            ],
        ];
    }

    private function first(array $address, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (isset($address[$key]) && $address[$key] !== '') {
                return (string) $address[$key];
            }
        }

        return null;
    }

    // Jarak antar panggilan upstream ≥ 1 detik (global, lintas request). Lock dipakai bila store mendukung.
    private function throttleUpstream(): void
    {
        $lock = Cache::getStore() instanceof LockProvider ? Cache::lock(self::LOCK_KEY, 5) : null;

        if ($lock) {
            try {
                $lock->block(5);
            } catch (LockTimeoutException $e) {
                $lock = null; // lanjut tanpa lock daripada menggagalkan request
            }
        }

        try {
            $last = (float) Cache::get(self::LAST_CALL_KEY, 0);
            $wait = self::UPSTREAM_MIN_INTERVAL_SECONDS - (microtime(true) - $last);

            if ($wait > 0) {
                usleep((int) ceil($wait * 1_000_000));
            }

            Cache::put(self::LAST_CALL_KEY, microtime(true), 60);
        } finally {
            $lock?->release();
        }
    }

    private function upstreamError(): ApiException
    {
        return new ApiException(502, 'UPSTREAM_ERROR', __('account.geo_upstream_error'));
    }
}
