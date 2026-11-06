<?php

namespace Tests\Feature\Cms;

use App\Models\Media;
use App\Models\Page;
use App\Models\PageSection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CatalogFixtures;
use Tests\TestCase;

class MediaFrameTest extends TestCase
{
    use RefreshDatabase, CatalogFixtures;

    private function photo(): Media
    {
        return Media::create(['disk' => 'public', 'path' => 'x/pabrik.jpg', 'original_name' => 'pabrik.jpg', 'mime' => 'image/jpeg', 'size' => 10]);
    }

    public function test_section_media_keeps_a_per_use_frame_and_plain_ids_still_work(): void
    {
        $admin = $this->adminWith(['cms']);
        $page = Page::create(['slug' => 'bisnis', 'title' => ['id' => 'Bisnis'], 'status' => 'published']);
        $photo = $this->photo();
        $url = "/api/v1/admin/pages/{$page->id}/sections";
        $body = ['body' => ['id' => '<p>Pabrik.</p>'], 'image_side' => 'left'];

        $created = $this->actingAs($admin)->postJson($url, ['type' => 'text_visual', 'content' => $body + [
            'image' => ['id' => $photo->id, 'frame' => ['x' => 20, 'y' => 75.5, 'zoom' => 1.4, 'start' => 3, 'end' => 9]],
        ]])->assertStatus(201)
            ->assertJsonPath('data.content.image.id', $photo->id)
            ->assertJsonPath('data.content.image.url', $photo->url())
            ->assertJsonPath('data.content.image.frame.x', 20)
            ->assertJsonPath('data.content.image.frame.zoom', 1.4)
            ->assertJsonPath('data.content.image.frame.end', 9);
        $stored = PageSection::findOrFail($created->json('data.id'))->content['image'];
        $this->assertSame($photo->id, $stored['id']);

        // Bingkai bawaan (tengah, zoom 1, tanpa rentang) disimpan sebagai id biasa; hydrate tanpa key frame.
        $this->actingAs($admin)->putJson('/api/v1/admin/sections/'.$created->json('data.id'), ['content' => $body + [
            'image' => ['id' => $photo->id, 'frame' => ['x' => 50, 'y' => 50, 'zoom' => 1]],
        ]])->assertOk()->assertJsonMissing(['frame' => ['x' => 50]]);
        $this->assertSame($photo->id, PageSection::findOrFail($created->json('data.id'))->content['image']);

        // Konten section dinormalisasi sebelum validasi: nilai di luar rentang dipotong ke batasnya.
        $this->actingAs($admin)->postJson($url, ['type' => 'text_visual', 'content' => $body + [
            'image' => ['id' => $photo->id, 'frame' => ['x' => 140, 'zoom' => 9]],
        ]])->assertStatus(201)->assertJsonPath('data.content.image.frame.x', 100)->assertJsonPath('data.content.image.frame.zoom', 3);

        // Entitas lain memvalidasi langsung: di luar rentang = 422.
        $news = $this->adminWith(['news']);
        $this->actingAs($news)->postJson('/api/v1/admin/news', [
            'title' => ['id' => 'Berita'], 'body' => ['id' => '<p>Isi</p>'], 'coverMediaId' => $photo->id, 'coverFrame' => ['x' => 140],
        ])->assertStatus(422)->assertJsonValidationErrors(['coverFrame.x']);
    }

    public function test_post_cover_and_product_images_store_frames(): void
    {
        $photo = $this->photo();
        $admin = $this->adminWith(['news', 'products']);

        $this->actingAs($admin)->postJson('/api/v1/admin/news', [
            'title' => ['id' => 'Berita'], 'body' => ['id' => '<p>Isi</p>'], 'coverMediaId' => $photo->id,
            'coverFrame' => ['x' => 30, 'y' => 40, 'zoom' => 1.2],
        ])->assertCreated()
            ->assertJsonPath('data.coverFrame.x', 30)
            ->assertJsonPath('data.cover.frame.zoom', 1.2);

        $category = $this->makeCategory();
        $created = $this->actingAs($admin)->postJson('/api/v1/admin/products', [
            'code' => 'RSP-35', 'categoryId' => $category->id, 'name' => ['id' => 'Resiprene 35'], 'priceMode' => 'fixed',
            'price' => 185000, 'unit' => 'kg', 'moq' => 25, 'images' => [$photo->id], 'thumbnailMediaId' => $photo->id,
            'imageFrames' => [(string) $photo->id => ['x' => 65, 'y' => 35, 'zoom' => 1.5]],
        ])->assertCreated()
            ->assertJsonPath('data.images.0.frame.x', 65)
            ->assertJsonPath('data.imageFrame.zoom', 1.5);

        // imageFrames tidak dikirim saat update = bingkai dipertahankan.
        $id = $created->json('data.id');
        $this->actingAs($admin)->putJson("/api/v1/admin/products/$id", [
            'code' => 'RSP-35', 'categoryId' => $category->id, 'name' => ['id' => 'Resiprene 35'], 'priceMode' => 'fixed',
            'price' => 185000, 'unit' => 'kg', 'moq' => 25, 'images' => [$photo->id],
        ])->assertOk()->assertJsonPath('data.images.0.frame.x', 65);
    }
}
