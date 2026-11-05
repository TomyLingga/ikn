<?php

namespace Tests\Feature\Cms;

use App\Models\Media;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MediaUrlTest extends TestCase
{
    use RefreshDatabase;

    public function test_youtube_drive_and_direct_urls_become_library_media_without_files(): void
    {
        $admin = $this->adminWith(['media']);

        $yt = $this->actingAs($admin)->postJson('/api/v1/admin/media/url', ['url' => 'https://youtu.be/FGJQW6l2hrk?t=3'])
            ->assertCreated()
            ->assertJsonPath('data.mime', 'video/youtube')
            ->assertJsonPath('data.disk', 'external')
            ->assertJsonPath('data.provider', 'youtube')
            ->assertJsonPath('data.url', 'https://www.youtube.com/watch?v=FGJQW6l2hrk')
            ->assertJsonPath('data.embedUrl', 'https://www.youtube-nocookie.com/embed/FGJQW6l2hrk')
            ->json('data');
        $this->assertSame(0, $yt['size']);

        $this->actingAs($admin)->postJson('/api/v1/admin/media/url', ['url' => 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing'])
            ->assertCreated()
            ->assertJsonPath('data.mime', 'image/x-gdrive')
            ->assertJsonPath('data.url', 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrStUv');

        $this->actingAs($admin)->postJson('/api/v1/admin/media/url', ['url' => 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUv', 'kind' => 'video'])
            ->assertCreated()
            ->assertJsonPath('data.mime', 'video/x-gdrive')
            ->assertJsonPath('data.embedUrl', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/preview');

        $this->actingAs($admin)->postJson('/api/v1/admin/media/url', ['url' => 'https://cdn.example.com/foto/pabrik.webp', 'name' => 'Pabrik'])
            ->assertCreated()
            ->assertJsonPath('data.mime', 'image/webp')
            ->assertJsonPath('data.originalName', 'Pabrik');

        // Tanpa ekstensi dan tanpa jenis: admin harus memilih; video YouTube tidak boleh dipakai sebagai gambar.
        $this->actingAs($admin)->postJson('/api/v1/admin/media/url', ['url' => 'https://cdn.example.com/media/12345'])
            ->assertStatus(422)->assertJsonValidationErrors(['url']);
        $this->actingAs($admin)->postJson('/api/v1/admin/media/url', ['url' => 'https://www.youtube.com/watch?v=FGJQW6l2hrk', 'kind' => 'image'])
            ->assertStatus(422)->assertJsonValidationErrors(['url']);
        $this->actingAs($admin)->postJson('/api/v1/admin/media/url', ['url' => 'bukan url'])
            ->assertStatus(422)->assertJsonValidationErrors(['url']);

        // Tampil di library (filter video), lalu bisa dihapus tanpa menyentuh disk.
        $this->actingAs($admin)->getJson('/api/v1/admin/media?type=video')
            ->assertOk()->assertJsonFragment(['provider' => 'youtube']);
        $this->actingAs($admin)->deleteJson('/api/v1/admin/media/'.$yt['id'])->assertOk();
        $this->assertNull(Media::find($yt['id']));
    }
}
