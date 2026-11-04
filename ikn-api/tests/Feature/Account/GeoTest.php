<?php

namespace Tests\Feature\Account;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GeoTest extends TestCase
{
    use RefreshDatabase;

    private function nominatimItem(array $overrides = []): array
    {
        return array_merge([
            'place_id' => 1,
            'display_name' => 'Cakung, Jakarta Timur, DKI Jakarta, 13910, Indonesia',
            'lat' => '-6.1834000',
            'lon' => '106.9118000',
            'address' => [
                'road' => 'Jalan Industri Raya',
                'village' => 'Cakung Barat',
                'city_district' => 'Cakung',
                'city' => 'Jakarta Timur',
                'state' => 'Daerah Khusus Ibukota Jakarta',
                'postcode' => '13910',
                'country' => 'Indonesia',
            ],
        ], $overrides);
    }

    public function test_search_is_proxied_normalized_and_cached(): void
    {
        Http::fake(['*' => Http::response([$this->nominatimItem()], 200)]);
        $user = $this->customer();

        $this->actingAs($user)->getJson('/api/v1/geo/search?q=cakung')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.displayName', 'Cakung, Jakarta Timur, DKI Jakarta, 13910, Indonesia')
            ->assertJsonPath('data.0.lat', -6.1834)
            ->assertJsonPath('data.0.lng', 106.9118)
            ->assertJsonPath('data.0.address.road', 'Jalan Industri Raya')
            ->assertJsonPath('data.0.address.village', 'Cakung Barat')
            ->assertJsonPath('data.0.address.district', 'Cakung')
            ->assertJsonPath('data.0.address.city', 'Jakarta Timur')
            ->assertJsonPath('data.0.address.state', 'Daerah Khusus Ibukota Jakarta')
            ->assertJsonPath('data.0.address.postcode', '13910')
            ->assertJsonPath('data.0.country', 'Indonesia')
            ->assertJsonPath('data.0.countryCode', null);

        // Query sama (beda huruf besar/spasi) → dari cache, upstream tetap dipanggil sekali.
        $this->actingAs($user)->getJson('/api/v1/geo/search?q=cakung')->assertOk();
        $this->actingAs($user)->getJson('/api/v1/geo/search?q=%20Cakung%20')->assertOk()->assertJsonCount(1, 'data');
        Http::assertSentCount(1);

        Http::assertSent(function (Request $request) {
            return $request->hasHeader('User-Agent', config('ikn.nominatim.user_agent'))
                && str_starts_with($request->url(), config('ikn.nominatim.base_url').'/search?')
                && str_contains($request->url(), 'q=cakung')
                && str_contains($request->url(), 'format=jsonv2')
                && str_contains($request->url(), 'countrycodes=id')
                && str_contains($request->url(), 'limit=5')
                && str_contains($request->url(), 'addressdetails=1');
        });
    }

    /** scope=world (pelabuhan tujuan CIF, ASUMSI A-89): tanpa countrycodes=id, cache terpisah dari scope id, hasil membawa negara dan kelas OSM. */
    public function test_search_scope_world_drops_country_filter_and_returns_country_fields(): void
    {
        Http::fake(['*' => Http::response([$this->nominatimItem([
            'display_name' => 'Port Klang, Klang, Selangor, Malaysia',
            'lat' => '2.9997000',
            'lon' => '101.3929000',
            'class' => 'place',
            'type' => 'town',
            'address' => ['town' => 'Port Klang', 'county' => 'Klang', 'state' => 'Selangor', 'country' => 'Malaysia', 'country_code' => 'my'],
        ])], 200)]);
        $user = $this->customer();

        $this->actingAs($user)->getJson('/api/v1/geo/search?q=port+klang&scope=world')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.displayName', 'Port Klang, Klang, Selangor, Malaysia')
            ->assertJsonPath('data.0.lat', 2.9997)
            ->assertJsonPath('data.0.lng', 101.3929)
            ->assertJsonPath('data.0.country', 'Malaysia')
            ->assertJsonPath('data.0.countryCode', 'MY')
            ->assertJsonPath('data.0.class', 'place')
            ->assertJsonPath('data.0.type', 'town')
            ->assertJsonPath('data.0.address.city', 'Klang')
            ->assertJsonPath('data.0.address.state', 'Selangor');

        Http::assertSent(fn (Request $request) => str_contains(urldecode($request->url()), 'q=port klang')
            && ! str_contains($request->url(), 'countrycodes')
            && str_contains($request->url(), 'addressdetails=1'));

        // scope id (bawaan) untuk kata kunci yang sama adalah entri cache lain: upstream dipanggil lagi, kali ini dengan countrycodes=id.
        $this->actingAs($user)->getJson('/api/v1/geo/search?q=port+klang')->assertOk();
        $this->actingAs($user)->getJson('/api/v1/geo/search?q=port+klang&scope=id')->assertOk();
        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'countrycodes=id'));

        $this->actingAs($user)->getJson('/api/v1/geo/search?q=port+klang&scope=mars')->assertStatus(422)->assertJsonValidationErrors(['scope']);
    }

    public function test_reverse_returns_single_result_or_empty_list(): void
    {
        Http::fake(function (Request $request) {
            return str_contains($request->url(), 'lat=-6.1834')
                ? Http::response($this->nominatimItem(), 200)
                : Http::response(['error' => 'Unable to geocode'], 200);
        });
        $user = $this->customer();

        $this->actingAs($user)->getJson('/api/v1/geo/reverse?lat=-6.1834&lng=106.9118')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.address.postcode', '13910');

        $this->actingAs($user)->getJson('/api/v1/geo/reverse?lat=0&lng=0')
            ->assertOk()
            ->assertJsonPath('data', []);

        Http::assertSent(fn (Request $request) => str_starts_with($request->url(), config('ikn.nominatim.base_url').'/reverse?')
            && str_contains($request->url(), 'lon=106.9118'));
        Http::assertSentCount(2);
    }

    public function test_upstream_failure_returns_502_and_is_not_cached(): void
    {
        Http::fake(['*' => Http::response('Service Unavailable', 503)]);
        $user = $this->customer();

        $this->actingAs($user)->getJson('/api/v1/geo/search?q=cakung')
            ->assertStatus(502)
            ->assertJsonPath('code', 'UPSTREAM_ERROR');

        $this->actingAs($user)->getJson('/api/v1/geo/search?q=cakung')->assertStatus(502);
        Http::assertSentCount(2);
    }

    public function test_requires_authentication_and_validates_input(): void
    {
        Http::fake();

        $this->getJson('/api/v1/geo/search?q=cakung')->assertStatus(401)->assertJsonPath('code', 'UNAUTHENTICATED');

        $user = $this->customer();
        $this->actingAs($user)->getJson('/api/v1/geo/search?q=ca')->assertStatus(422)->assertJsonValidationErrors(['q']);
        $this->actingAs($user)->getJson('/api/v1/geo/reverse?lat=95&lng=10')->assertStatus(422)->assertJsonValidationErrors(['lat']);
        $this->actingAs($user)->getJson('/api/v1/geo/reverse')->assertStatus(422)->assertJsonValidationErrors(['lat', 'lng']);

        Http::assertNothingSent();
    }
}
