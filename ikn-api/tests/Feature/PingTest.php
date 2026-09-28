<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PingTest extends TestCase
{
    use RefreshDatabase;

    public function test_ping_returns_envelope_with_jakarta_offset(): void
    {
        $response = $this->getJson('/api/v1/ping');

        $response->assertOk()->assertJsonPath('data.ok', true);
        $this->assertStringContainsString('+07:00', $response->json('data.time'));
    }

    public function test_database_connection_uses_postgres_test_database(): void
    {
        $this->assertSame('ikn_test', DB::connection()->getDatabaseName());
        $this->assertSame('pgsql', DB::connection()->getDriverName());
        $this->assertNotEmpty(DB::select('SELECT now() AS now'));
    }

    public function test_model_timestamps_round_trip_in_app_timezone(): void
    {
        $post = \App\Models\Post::create(['slug' => 'tz', 'title' => ['id' => 'TZ'], 'is_published' => true, 'published_at' => now()]);

        $api = $this->getJson('/api/v1/content/news/tz')->assertOk()->json('data.publishedAt');
        $this->assertStringEndsWith('+07:00', $api);
        $this->assertLessThan(60, abs(now()->diffInSeconds(\Carbon\Carbon::parse($api))));

        // Instan di DB harus sama dengan jam aplikasi (bukan meleset 7 jam).
        $dbNow = \Carbon\Carbon::parse(DB::selectOne('SELECT now() AS now')->now);
        $this->assertLessThan(60, abs(now()->diffInSeconds($dbNow)));
        $stored = \Carbon\Carbon::parse(DB::table('posts')->where('slug', 'tz')->value('published_at'));
        $this->assertLessThan(60, abs(now()->diffInSeconds($stored)));
    }

    public function test_unknown_route_returns_not_found_envelope(): void
    {
        $this->getJson('/api/v1/does-not-exist')
            ->assertStatus(404)
            ->assertJsonPath('code', 'NOT_FOUND');
    }
}
