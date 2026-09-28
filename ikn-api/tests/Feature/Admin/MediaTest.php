<?php

namespace Tests\Feature\Admin;

use App\Models\Media;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('private');
    }

    public function test_admin_uploads_image_to_public_disk(): void
    {
        $admin = $this->adminWith(['media']);

        $response = $this->actingAs($admin)->post('/api/v1/admin/media', [
            'file' => UploadedFile::fake()->image('foto pabrik.jpg', 640, 480),
            'collection' => 'gallery',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.collection', 'gallery')
            ->assertJsonPath('data.mime', 'image/jpeg')
            ->assertJsonPath('data.isImage', true);

        $media = Media::first();
        Storage::disk('public')->assertExists($media->path);
        $this->assertStringStartsWith('gallery/', $media->path);
        $this->assertSame($admin->id, $media->uploaded_by);
    }

    public function test_unsupported_mime_is_rejected_with_415(): void
    {
        $this->actingAs($this->adminWith(['media']))->post('/api/v1/admin/media', [
            'file' => UploadedFile::fake()->create('script.exe', 10, 'application/x-msdownload'),
        ])->assertStatus(415)->assertJsonPath('code', 'UNSUPPORTED_MEDIA_TYPE');
    }

    public function test_oversized_file_is_rejected_with_413(): void
    {
        config(['ikn.media.image_max_kb' => 1]);

        $this->actingAs($this->adminWith(['media']))->post('/api/v1/admin/media', [
            'file' => UploadedFile::fake()->image('big.png', 2000, 2000),
        ])->assertStatus(413)->assertJsonPath('code', 'FILE_TOO_LARGE');
    }

    public function test_referenced_media_cannot_be_deleted(): void
    {
        $media = Media::create(['disk' => 'public', 'path' => 'x/a.jpg', 'original_name' => 'a.jpg', 'mime' => 'image/jpeg', 'size' => 10]);
        Post::create(['slug' => 'a', 'title' => ['id' => 'A'], 'cover_media_id' => $media->id]);

        $this->actingAs($this->superAdmin())->deleteJson('/api/v1/admin/media/'.$media->id)
            ->assertStatus(409)->assertJsonPath('code', 'MEDIA_IN_USE');

        $this->assertDatabaseHas('media', ['id' => $media->id]);
    }

    public function test_private_file_requires_admin(): void
    {
        Storage::disk('private')->put('wbs/secret.pdf', '%PDF-1.4 test');
        $media = Media::create(['disk' => 'private', 'path' => 'wbs/secret.pdf', 'original_name' => 'secret.pdf', 'mime' => 'application/pdf', 'size' => 12]);

        $this->get('/api/v1/files/'.$media->id)->assertStatus(401);
        $this->actingAs($this->customer())->get('/api/v1/files/'.$media->id)->assertStatus(403);
        $this->actingAs($this->adminWith(['wbs']))->get('/api/v1/files/'.$media->id)->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');
    }
}
