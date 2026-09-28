<?php

namespace Tests\Feature\Cms;

use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_generates_slug_and_publish_date(): void
    {
        $admin = $this->adminWith(['news']);

        $response = $this->actingAs($admin)->postJson('/api/v1/admin/news', [
            'title' => ['id' => 'Resiprene 35 menembus pasar ekspor', 'en' => 'Resiprene 35 enters export markets'],
            'excerpt' => ['id' => 'Ringkasan'],
            'body' => ['id' => '<p>Isi berita</p>'],
            'tag' => 'Produk',
            'isPublished' => true,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.slug', 'resiprene-35-menembus-pasar-ekspor')
            ->assertJsonPath('data.excerpt.en', 'Ringkasan');
        $this->assertNotNull($response->json('data.publishedAt'));

        // Judul sama → slug diberi akhiran.
        $this->actingAs($admin)->postJson('/api/v1/admin/news', ['title' => ['id' => 'Resiprene 35 menembus pasar ekspor']])
            ->assertStatus(201)->assertJsonPath('data.slug', 'resiprene-35-menembus-pasar-ekspor-2');
    }

    public function test_publish_date_input_in_utc_is_stored_as_the_same_instant(): void
    {
        $admin = $this->adminWith(['news']);

        // Browser mengirim ISO UTC (datetime-local -> toISOString); instan harus dipertahankan, bukan angka jamnya.
        $response = $this->actingAs($admin)->postJson('/api/v1/admin/news', [
            'title' => ['id' => 'Zona waktu'],
            'isPublished' => false,
            'publishedAt' => '2026-09-22T03:45:00.000Z',
        ]);

        $response->assertStatus(201)->assertJsonPath('data.publishedAt', '2026-09-22T10:45:00+07:00');
        $this->assertSame('2026-09-22T10:45:00+07:00', Post::where('slug', 'zona-waktu')->firstOrFail()->published_at->toApiString());

        // Offset lain juga dikonversi ke instan yang sama.
        $this->actingAs($admin)->postJson('/api/v1/admin/news', [
            'title' => ['id' => 'Zona waktu 2'],
            'isPublished' => false,
            'publishedAt' => '2026-09-22T05:45:00+02:00',
        ])->assertStatus(201)->assertJsonPath('data.publishedAt', '2026-09-22T10:45:00+07:00');
    }

    public function test_body_html_is_sanitized_and_author_reading_time_are_returned(): void
    {
        $admin = $this->adminWith(['news']);
        $dirty = '<h2 onclick="x()">Judul</h2><p style="color:red;text-align:center">Teks <strong>tebal</strong> <a href="javascript:alert(1)">x</a> <a href="https://ptpn.id" target="_blank" rel="noopener">tautan</a></p>'
            .'<script>alert(1)</script><img src="/storage/news/a.jpg" alt="foto" onerror="x()"><iframe src="https://www.youtube-nocookie.com/embed/abc123" allowfullscreen></iframe><iframe src="https://evil.example/x"></iframe>';

        $response = $this->actingAs($admin)->postJson('/api/v1/admin/news', [
            'title' => ['id' => 'Sanitasi'],
            'excerpt' => ['id' => '<b>Ringkas</b> <script>x</script>'],
            'body' => ['id' => $dirty],
            'author' => '  Humas  ',
            'isPublished' => true,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.author', 'Humas')
            ->assertJsonPath('data.readingMinutes', 1)
            ->assertJsonPath('data.excerpt.id', 'Ringkas x');
        $body = $response->json('data.body.id');
        $this->assertStringNotContainsString('onclick', $body);
        $this->assertStringNotContainsString('<script', $body);
        $this->assertStringNotContainsString('javascript:', $body);
        $this->assertStringNotContainsString('onerror', $body);
        $this->assertStringNotContainsString('evil.example', $body);
        $this->assertStringNotContainsString('color:red', $body);
        $this->assertStringContainsString('text-align:center', $body);
        $this->assertStringContainsString('<strong>tebal</strong>', $body);
        $this->assertStringContainsString('href="https://ptpn.id" target="_blank" rel="noopener noreferrer"', $body);
        $this->assertStringNotContainsString('<iframe></iframe>', $body);
        $this->assertStringContainsString('<img src="/storage/news/a.jpg" alt="foto"', $body);
        $this->assertStringContainsString('youtube-nocookie.com/embed/abc123', $body);

        // Editor kosong (<p></p>) dianggap tidak ada isi; EN kosong ikut ID.
        $this->actingAs($admin)->postJson('/api/v1/admin/news', ['title' => ['id' => 'Kosong'], 'body' => ['id' => '<p></p>']])
            ->assertStatus(201)->assertJsonPath('data.body.id', '')->assertJsonPath('data.body.en', '');
    }

    public function test_related_posts_prefer_same_tag_and_max_three(): void
    {
        Post::create(['slug' => 'utama', 'title' => ['id' => 'Utama'], 'tag' => 'Produk', 'is_published' => true, 'published_at' => now()->subDays(10)]);
        foreach (['a' => 'Perusahaan', 'b' => 'Produk', 'c' => 'Perusahaan', 'd' => 'Kemitraan'] as $slug => $tag) {
            Post::create(['slug' => $slug, 'title' => ['id' => strtoupper($slug)], 'tag' => $tag, 'is_published' => true, 'published_at' => now()->subDay()]);
        }

        $related = $this->getJson('/api/v1/content/news/utama')->assertOk()->json('data.related');
        $this->assertCount(3, $related);
        $this->assertSame('b', $related[0]['slug']);
        $this->assertArrayHasKey('readingMinutes', $related[0]);
    }

    public function test_public_list_only_shows_published_and_search_is_case_insensitive(): void
    {
        Post::create(['slug' => 'terbit', 'title' => ['id' => 'Kemitraan Hilir Karet'], 'is_published' => true, 'published_at' => now()->subDay()]);
        Post::create(['slug' => 'draf', 'title' => ['id' => 'Draf rahasia'], 'is_published' => false]);
        Post::create(['slug' => 'nanti', 'title' => ['id' => 'Terjadwal'], 'is_published' => true, 'published_at' => now()->addDay()]);

        $list = $this->getJson('/api/v1/content/news')->assertOk();
        $this->assertSame(['terbit'], array_column($list->json('data'), 'slug'));
        $this->assertArrayNotHasKey('body', $list->json('data.0'));

        $this->getJson('/api/v1/content/news/draf')->assertStatus(404);
        $this->getJson('/api/v1/content/news/terbit')->assertOk()->assertJsonPath('data.slug', 'terbit')->assertJsonStructure(['data' => ['related']]);

        $admin = $this->adminWith(['news']);
        $search = $this->actingAs($admin)->getJson('/api/v1/admin/news?q=hilir')->assertOk();
        $this->assertSame(['terbit'], array_column($search->json('data'), 'slug'));
    }

    public function test_update_and_delete(): void
    {
        $post = Post::create(['slug' => 'lama', 'title' => ['id' => 'Lama']]);
        $admin = $this->adminWith(['news']);

        $this->actingAs($admin)->putJson('/api/v1/admin/news/'.$post->id, ['title' => ['id' => 'Baru'], 'slug' => 'baru', 'isPublished' => true])
            ->assertOk()->assertJsonPath('data.slug', 'baru')->assertJsonPath('data.isPublished', true);

        $this->actingAs($admin)->deleteJson('/api/v1/admin/news/'.$post->id)->assertOk();
        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
    }
}
