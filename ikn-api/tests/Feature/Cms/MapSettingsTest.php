<?php

namespace Tests\Feature\Cms;

use App\Models\AuditLog;
use App\Models\Setting;
use App\Services\Cms\SettingsService;
use App\Services\Geo\MapConfigService;
use App\Support\TileUrlTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

// Penyedia tile peta dari admin (ASUMSI A-98): grup maps privat, API key Google terenkripsi + dimask,
// GET /geo/map-config (bawaan, custom, Google lewat token sesi, cadangan saat Google gagal) dan tombol uji.
class MapSettingsTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'AIzaSyTEST-key-0123456789';

    private const STREET = 'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=abc';

    private const SATELLITE = 'https://{s}.tiles.example.com/sat/{z}/{x}/{y}{r}.jpg';

    private const CONFIG = '/api/v1/geo/map-config';

    private const SETTINGS = '/api/v1/admin/site-settings';

    private const TEST = '/api/v1/admin/site-settings/maps-test';

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->withHeaders(['Accept-Language' => 'id']); // pesan hasil uji diperiksa dalam Bahasa Indonesia
    }

    /** Google menjawab createSession (token per jenis peta) dan tile. */
    private function fakeGoogle(?int $expiry = null): void
    {
        $expiry ??= time() + 14 * 86400;
        Http::fake([
            'tile.googleapis.com/v1/createSession*' => function (Request $request) use ($expiry) {
                $type = $request['mapType'].(isset($request['layerTypes']) ? '+labels' : '');

                return Http::response(['session' => 'sess-'.$type, 'expiry' => (string) $expiry, 'tileWidth' => 256, 'tileHeight' => 256, 'imageFormat' => 'png']);
            },
            'tile.googleapis.com/v1/2dtiles/*' => Http::response('PNG', 200, ['Content-Type' => 'image/png']),
        ]);
    }

    private function useGoogle(): void
    {
        app(SettingsService::class)->update(['maps' => ['provider' => 'google', 'google_api_key' => self::KEY]]);
    }

    public function test_default_config_serves_the_keyless_tiles_to_guests(): void
    {
        Http::fake();

        $this->getJson(self::CONFIG)
            ->assertOk()
            ->assertJsonPath('data.provider', 'default')
            ->assertJsonPath('data.fallback', false)
            ->assertJsonPath('data.layers.street.url', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
            ->assertJsonPath('data.layers.street.maxZoom', 19)
            ->assertJsonPath('data.layers.street.brand', null)
            ->assertJsonPath('data.layers.satellite.url', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
            ->assertJsonPath('data.layers.satelliteLabels.url', 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}')
            ->assertJsonPath('data.layers.hybrid', null);
        Http::assertNothingSent();
    }

    public function test_maps_settings_are_private_masked_encrypted_and_validated(): void
    {
        $admin = $this->adminWith(['settings']);

        // URL bukan https, tanpa {y}, placeholder asing, host lokal, zoom di luar batas, penyedia asing: tidak ada yang ditulis.
        $this->actingAs($admin)->putJson(self::SETTINGS, ['maps' => [
            'provider' => 'bing',
            'custom_street_url' => 'http://tiles.example.com/{z}/{x}/{y}.png',
            'custom_satellite_url' => 'https://tiles.example.com/{z}/{x}.png',
            'custom_max_zoom' => 30,
            'custom_attribution' => str_repeat('a', 301),
        ]])->assertStatus(422)->assertJsonValidationErrors(['maps.provider', 'maps.custom_street_url', 'maps.custom_satellite_url', 'maps.custom_max_zoom', 'maps.custom_attribution']);
        $this->assertDatabaseMissing('settings', ['key' => 'maps.provider']);
        foreach (['https://tiles.example.com/{z}/{x}/{-y}.png', 'https://localhost/{z}/{x}/{y}.png', 'https://10.0.0.5/{z}/{x}/{y}.png', 'https://tiles.example.com/{z}/{x}/{y}.png?k=<script>', 'https://127.1/{z}/{x}/{y}.png', 'https://0x7f.0.0.1/{z}/{x}/{y}.png', 'https://0177.0.0.1/{z}/{x}/{y}.png', 'https://[::1]/{z}/{x}/{y}.png'] as $bad) {
            $this->assertFalse(TileUrlTemplate::isValid($bad), $bad);
        }
        $this->assertTrue(TileUrlTemplate::isValid('https://8.8.8.8/{z}/{x}/{y}.png'));

        // Google tanpa key dan custom tanpa URL ditolak.
        $this->actingAs($admin)->putJson(self::SETTINGS, ['maps' => ['provider' => 'google']])
            ->assertStatus(422)->assertJsonValidationErrors(['maps.google_api_key']);
        $this->actingAs($admin)->putJson(self::SETTINGS, ['maps' => ['provider' => 'custom', 'custom_street_url' => '', 'custom_satellite_url' => '']])
            ->assertStatus(422)->assertJsonValidationErrors(['maps.custom_street_url']);

        $this->actingAs($admin)->putJson(self::SETTINGS, ['maps' => ['provider' => 'google', 'google_api_key' => self::KEY]])
            ->assertOk()
            ->assertJsonPath('data.maps.provider', 'google')
            ->assertJsonPath('data.maps.google_api_key', SettingsService::SECRET_MASK)
            ->assertJsonPath('data.maps.custom_max_zoom', 19);

        // GET admin tidak pernah memuat key asli; publik tidak melihat grup maps; DB menyimpan key terenkripsi.
        $index = $this->actingAs($admin)->getJson(self::SETTINGS)->assertOk()->assertJsonPath('data.maps.google_api_key', SettingsService::SECRET_MASK);
        $this->assertStringNotContainsString(self::KEY, $index->getContent());
        $this->assertArrayNotHasKey('maps', $this->getJson('/api/v1/content/settings')->json('data'));
        $stored = Setting::find('maps.google_api_key')->value;
        $this->assertNotSame(self::KEY, $stored);
        $this->assertSame(self::KEY, Crypt::decryptString($stored));
        // Catatan audit tidak memuat key.
        $this->assertStringNotContainsString(self::KEY, (string) json_encode(AuditLog::all()->pluck('after')));

        // Mask dikirim balik = key tetap, jadi penyedia google tetap sah; string kosong = dihapus dan ditolak.
        $this->actingAs($admin)->putJson(self::SETTINGS, ['maps' => ['provider' => 'google', 'google_api_key' => SettingsService::SECRET_MASK]])->assertOk();
        $this->assertSame(self::KEY, app(SettingsService::class)->secret('maps.google_api_key'));
        $this->actingAs($admin)->putJson(self::SETTINGS, ['maps' => ['provider' => 'google', 'google_api_key' => '']])
            ->assertStatus(422)->assertJsonValidationErrors(['maps.google_api_key']);

        $this->actingAs($this->adminWith(['cms']))->putJson(self::SETTINGS, ['maps' => ['provider' => 'default']])->assertStatus(403);
    }

    public function test_custom_config_uses_the_templates_and_escapes_the_attribution(): void
    {
        Http::fake();
        app(SettingsService::class)->update(['maps' => [
            'provider' => 'custom',
            'custom_street_url' => self::STREET,
            'custom_satellite_url' => self::SATELLITE,
            'custom_attribution' => '© MapTiler <b>© OpenStreetMap</b>',
            'custom_max_zoom' => 20,
        ]]);

        $this->getJson(self::CONFIG)
            ->assertOk()
            ->assertJsonPath('data.provider', 'custom')
            ->assertJsonPath('data.fallback', false)
            ->assertJsonPath('data.layers.street.url', self::STREET)
            ->assertJsonPath('data.layers.street.maxZoom', 20)
            ->assertJsonPath('data.layers.street.subdomains', null)
            ->assertJsonPath('data.layers.street.attribution', '© MapTiler &lt;b&gt;© OpenStreetMap&lt;/b&gt;')
            ->assertJsonPath('data.layers.satellite.url', self::SATELLITE)
            ->assertJsonPath('data.layers.satellite.subdomains', 'abc')
            ->assertJsonPath('data.layers.satelliteLabels', null);

        // Hanya peta jalan yang diisi: citra satelit + labelnya tetap bawaan.
        app(SettingsService::class)->update(['maps' => ['custom_satellite_url' => '']]);
        $this->getJson(self::CONFIG)
            ->assertOk()
            ->assertJsonPath('data.layers.street.url', self::STREET)
            ->assertJsonPath('data.layers.satellite.url', config('ikn.maps.default.satellite.url'))
            ->assertJsonPath('data.layers.satelliteLabels.url', config('ikn.maps.default.satellite_labels.url'));
        Http::assertNothingSent();
    }

    public function test_google_config_creates_one_cached_session_per_map_type(): void
    {
        $this->fakeGoogle();
        $this->useGoogle();

        $response = $this->getJson(self::CONFIG)
            ->assertOk()
            ->assertJsonPath('data.provider', 'google')
            ->assertJsonPath('data.fallback', false)
            ->assertJsonPath('data.layers.street.url', 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=sess-roadmap&key='.self::KEY)
            ->assertJsonPath('data.layers.street.brand', 'google')
            ->assertJsonPath('data.layers.street.maxZoom', 22)
            ->assertJsonPath('data.layers.street.attributionUrl', 'https://tile.googleapis.com/tile/v1/viewport?session=sess-roadmap&key='.self::KEY)
            ->assertJsonPath('data.layers.satellite.url', 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=sess-satellite&key='.self::KEY)
            ->assertJsonPath('data.layers.hybrid.url', 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=sess-satellite%2Blabels&key='.self::KEY)
            ->assertJsonPath('data.layers.satelliteLabels', null);
        $this->assertStringNotContainsString('mt0.google.com', $response->getContent());

        // Satu createSession per jenis peta, dengan Referer situs (key dibatasi HTTP referrer) dan bahasa/wilayah.
        Http::assertSentCount(3);
        Http::assertSent(fn (Request $request) => $request->method() === 'POST'
            && str_starts_with($request->url(), 'https://tile.googleapis.com/v1/createSession?key='.self::KEY)
            && $request['mapType'] === 'satellite' && isset($request['layerTypes']) && $request['layerTypes'] === ['layerRoadmap']
            && $request['language'] === 'id-ID' && $request['region'] === 'ID'
            && $request->hasHeader('Referer', rtrim(config('ikn.frontend_url'), '/').'/'));

        // Permintaan berikutnya memakai cache konfigurasi; setelah cache konfigurasi habis, token sesi masih dipakai ulang.
        $this->getJson(self::CONFIG)->assertOk();
        MapConfigService::forget();
        $this->getJson(self::CONFIG)->assertOk()->assertJsonPath('data.layers.street.url', 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=sess-roadmap&key='.self::KEY);
        Http::assertSentCount(3);
    }

    public function test_google_session_is_renewed_shortly_before_it_expires(): void
    {
        // Token yang kedaluwarsa dalam sejam (di dalam margin 1 hari) tidak disimpan: tiap pembuatan konfigurasi meminta yang baru.
        $this->fakeGoogle(time() + 3600);
        $this->useGoogle();

        $this->getJson(self::CONFIG)->assertOk()->assertJsonPath('data.fallback', false);
        MapConfigService::forget();
        $this->getJson(self::CONFIG)->assertOk();
        Http::assertSentCount(6);
    }

    public function test_google_failure_falls_back_to_default_tiles_and_logs_a_warning(): void
    {
        Http::fake(['tile.googleapis.com/*' => Http::response(['error' => ['code' => 403, 'message' => 'This API method requires billing to be enabled. key='.self::KEY, 'status' => 'PERMISSION_DENIED']], 403)]);
        Log::spy();
        $this->useGoogle();

        $response = $this->getJson(self::CONFIG)
            ->assertOk()
            ->assertJsonPath('data.provider', 'google')
            ->assertJsonPath('data.fallback', true)
            ->assertJsonPath('data.layers.street.url', config('ikn.maps.default.street.url'))
            ->assertJsonPath('data.layers.satellite.url', config('ikn.maps.default.satellite.url'))
            ->assertJsonPath('data.layers.hybrid', null);
        $this->assertStringNotContainsString(self::KEY, $response->getContent());
        $this->assertStringNotContainsString('billing', $response->getContent());
        Log::shouldHaveReceived('warning')->once()->withArgs(fn ($message) => str_contains($message, 'requires billing') && ! str_contains($message, self::KEY));

        // Kegagalan di-cache sebentar: Google tidak ditembak pada setiap permintaan halaman.
        $this->getJson(self::CONFIG)->assertOk()->assertJsonPath('data.fallback', true);
        Http::assertSentCount(1);
    }

    public function test_saving_settings_clears_the_cached_config(): void
    {
        Http::fake();
        $admin = $this->adminWith(['settings']);

        $this->getJson(self::CONFIG)->assertOk()->assertJsonPath('data.provider', 'default');
        $this->assertNotNull(Cache::get(MapConfigService::CACHE_KEY));

        $this->actingAs($admin)->putJson(self::SETTINGS, ['maps' => ['provider' => 'custom', 'custom_street_url' => self::STREET]])->assertOk();
        $this->assertNull(Cache::get(MapConfigService::CACHE_KEY));
        $this->getJson(self::CONFIG)->assertOk()->assertJsonPath('data.provider', 'custom')->assertJsonPath('data.layers.street.url', self::STREET);

        // Menyimpan grup lain tidak membuang cache peta.
        $this->actingAs($admin)->putJson(self::SETTINGS, ['company' => ['short' => 'IKN']])->assertOk();
        $this->assertNotNull(Cache::get(MapConfigService::CACHE_KEY));
    }

    public function test_maps_test_reports_each_google_layer_with_form_values(): void
    {
        $this->fakeGoogle();
        $admin = $this->adminWith(['settings']);

        $this->actingAs($admin)->postJson(self::TEST, ['maps' => ['provider' => 'google', 'google_api_key' => self::KEY]])
            ->assertOk()
            ->assertJsonPath('data.provider', 'google')
            ->assertJsonPath('data.ok', true)
            ->assertJsonCount(3, 'data.results')
            ->assertJsonPath('data.results.0.layer', 'street')
            ->assertJsonPath('data.results.0.ok', true)
            ->assertJsonPath('data.results.2.layer', 'hybrid')
            ->assertJsonPath('data.config.fallback', false)
            ->assertJsonPath('data.config.layers.street.brand', 'google');
        // Tiga token + tiga tile contoh; pratinjau memakai token yang sama (tidak ada permintaan tambahan).
        Http::assertSentCount(6);
        // Uji tidak menyimpan apa pun dan tidak mengubah konfigurasi publik.
        $this->assertDatabaseMissing('settings', ['key' => 'maps.provider']);
        $this->getJson(self::CONFIG)->assertOk()->assertJsonPath('data.provider', 'default');
        $this->assertStringNotContainsString(self::KEY, (string) json_encode(AuditLog::all()->pluck('after')));

        // Mask = key tersimpan.
        $this->useGoogle();
        $this->actingAs($admin)->postJson(self::TEST, ['maps' => ['provider' => 'google', 'google_api_key' => SettingsService::SECRET_MASK]])
            ->assertOk()->assertJsonPath('data.ok', true);
        // Tanpa body = pengaturan tersimpan.
        $this->actingAs($admin)->postJson(self::TEST)->assertOk()->assertJsonPath('data.provider', 'google')->assertJsonPath('data.ok', true);
    }

    public function test_maps_test_explains_google_and_custom_failures(): void
    {
        $admin = $this->adminWith(['settings']);

        Http::fake(['tile.googleapis.com/*' => Http::response(['error' => ['code' => 400, 'message' => 'API key not valid. Please pass a valid API key.', 'status' => 'INVALID_ARGUMENT']], 400)]);
        $this->actingAs($admin)->postJson(self::TEST, ['maps' => ['provider' => 'google', 'google_api_key' => 'salah']])
            ->assertOk()
            ->assertJsonPath('data.ok', false)
            ->assertJsonPath('data.results.0.ok', false)
            ->assertJsonPath('data.results.0.message', 'Google menolak permintaan: API key not valid. Please pass a valid API key. (INVALID_ARGUMENT)')
            ->assertJsonPath('data.config.fallback', true)
            ->assertJsonPath('data.config.layers.street.url', config('ikn.maps.default.street.url'));
        $this->actingAs($admin)->postJson(self::TEST, ['maps' => ['provider' => 'google', 'google_api_key' => '']])
            ->assertOk()->assertJsonPath('data.ok', false)->assertJsonPath('data.results.0.message', 'API key Google Maps belum diisi.');

        // Custom: satu tile zoom rendah per URL; jalan diterima, satelit ditolak penyedia.
        Http::fake([
            'api.maptiler.com/*' => Http::response('PNG', 200, ['Content-Type' => 'image/png']),
            'a.tiles.example.com/*' => Http::response('Invalid key', 403, ['Content-Type' => 'text/plain']),
        ]);
        $this->actingAs($admin)->postJson(self::TEST, ['maps' => ['provider' => 'custom', 'custom_street_url' => self::STREET, 'custom_satellite_url' => self::SATELLITE]])
            ->assertOk()
            ->assertJsonPath('data.ok', false)
            ->assertJsonPath('data.results.0.layer', 'street')
            ->assertJsonPath('data.results.0.ok', true)
            ->assertJsonPath('data.results.0.message', 'Tile contoh diterima dari api.maptiler.com.')
            ->assertJsonPath('data.results.1.layer', 'satellite')
            ->assertJsonPath('data.results.1.ok', false)
            ->assertJsonPath('data.results.1.message', 'a.tiles.example.com menjawab HTTP 403. Periksa URL, API key, atau pembatasan domain pada key.');
        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.maptiler.com/maps/streets-v2/256/1/1/0.png?key=abc');
        Http::assertSent(fn (Request $request) => $request->url() === 'https://a.tiles.example.com/sat/1/1/0.jpg');

        // Hanya URL jalan: lolos, lapisan kosong memakai bawaan, pratinjau memakai templat itu.
        $this->actingAs($admin)->postJson(self::TEST, ['maps' => ['provider' => 'custom', 'custom_street_url' => self::STREET, 'custom_satellite_url' => '']])
            ->assertOk()
            ->assertJsonPath('data.ok', true)
            ->assertJsonPath('data.config.layers.street.url', self::STREET)
            ->assertJsonPath('data.config.layers.satellite.url', config('ikn.maps.default.satellite.url'));

        // Jawaban 200 yang bukan gambar (halaman HTML galat) tetap gagal.
        Http::fake(['*' => Http::response('<html>', 200, ['Content-Type' => 'text/html'])]);
        $this->actingAs($admin)->postJson(self::TEST, ['maps' => ['provider' => 'custom', 'custom_street_url' => 'https://tiles.contoh.co.id/{z}/{x}/{y}.png']])
            ->assertOk()->assertJsonPath('data.ok', false)->assertJsonPath('data.results.0.message', 'Jawaban penyedia bukan gambar tile. Periksa URL atau API key.');
    }

    public function test_maps_test_validates_input_and_requires_the_settings_module(): void
    {
        Http::fake();
        $admin = $this->adminWith(['settings']);

        $this->actingAs($admin)->postJson(self::TEST, ['maps' => ['provider' => 'bing', 'custom_street_url' => 'http://tiles.example.com/{z}/{x}/{y}.png', 'custom_max_zoom' => 0]])
            ->assertStatus(422)->assertJsonValidationErrors(['maps.provider', 'maps.custom_street_url', 'maps.custom_max_zoom']);
        $this->actingAs($admin)->postJson(self::TEST, ['maps' => ['provider' => 'default']])
            ->assertOk()->assertJsonPath('data.ok', true)->assertJsonPath('data.config.provider', 'default');

        $this->actingAs($this->adminWith(['cms']))->postJson(self::TEST, ['maps' => ['provider' => 'default']])->assertStatus(403);
        $this->actingAs($this->customer())->postJson(self::TEST)->assertStatus(403);
        Http::assertNothingSent();
    }

    public function test_guests_cannot_run_the_maps_test(): void
    {
        $this->postJson(self::TEST)->assertStatus(401);
    }
}
