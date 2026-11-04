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
// scope id (bawaan) membatasi countrycodes=id (alamat customer); scope world tanpa batas negara (pelabuhan tujuan CIF, A-89).
class NominatimClient
{
    public const UPSTREAM_MIN_INTERVAL_SECONDS = 1.0;

    public const SCOPE_ID = 'id';
    public const SCOPE_WORLD = 'world';
    public const SCOPES = [self::SCOPE_ID, self::SCOPE_WORLD];

    private const CACHE_PREFIX = 'geo:';

    private const LOCK_KEY = 'geo:nominatim:lock';

    private const LAST_CALL_KEY = 'geo:nominatim:last';

    /** @return array<int, array<string, mixed>> */
    public function search(string $query, string $scope = self::SCOPE_ID): array
    {
        $query = trim($query);
        $scope = in_array($scope, self::SCOPES, true) ? $scope : self::SCOPE_ID;
        // Cache lama (tanpa scope) tetap berlaku untuk scope id agar hasil yang sudah tersimpan tidak dibuang.
        $key = self::CACHE_PREFIX.'search:'.($scope === self::SCOPE_ID ? '' : $scope.':').sha1(mb_strtolower($query));
        $ttl = now()->addDays((int) config('ikn.nominatim.search_cache_days', 7));

        return Cache::remember($key, $ttl, fn () => $this->fetch('search', ['q' => $query], $scope));
    }

    /** @return array<int, array<string, mixed>> */
    public function reverse(float $lat, float $lng): array
    {
        $key = self::CACHE_PREFIX.'reverse:'.sha1(sprintf('%.5f,%.5f', $lat, $lng));
        $ttl = now()->addDays((int) config('ikn.nominatim.reverse_cache_days', 30));

        return Cache::remember($key, $ttl, fn () => $this->fetch('reverse', ['lat' => $lat, 'lon' => $lng]));
    }

    /** @return array<int, array<string, mixed>> */
    private function fetch(string $endpoint, array $params, string $scope = self::SCOPE_ID): array
    {
        $this->throttleUpstream();

        $url = rtrim((string) config('ikn.nominatim.base_url'), '/').'/'.$endpoint;
        $query = $params + ['format' => 'jsonv2', 'limit' => 5, 'addressdetails' => 1];
        if ($scope === self::SCOPE_ID) {
            $query['countrycodes'] = 'id';
        }

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

    /**
     * Bentuk kontrak: { displayName, lat, lng, country, countryCode, class, type, address { road, village, district, city, state, postcode } }.
     * country/countryCode (ISO alpha-2 huruf besar) dan class/type OSM (mis. natural/bay, place/city) membantu pemilih pelabuhan tujuan.
     */
    private function normalize(array $item): array
    {
        $address = is_array($item['address'] ?? null) ? $item['address'] : [];
        $countryCode = isset($address['country_code']) && is_string($address['country_code']) ? strtoupper(trim($address['country_code'])) : null;

        return [
            'displayName' => (string) ($item['display_name'] ?? ''),
            'lat' => (float) $item['lat'],
            'lng' => (float) $item['lon'],
            'country' => $this->first($address, ['country']),
            'countryCode' => $countryCode !== null && preg_match('/^[A-Z]{2}$/', $countryCode) ? $countryCode : null,
            'class' => isset($item['class']) && is_string($item['class']) ? $item['class'] : (isset($item['category']) && is_string($item['category']) ? $item['category'] : null),
            'type' => isset($item['type']) && is_string($item['type']) ? $item['type'] : null,
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
