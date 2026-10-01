<?php

namespace Tests\Feature\Cms;

use App\Models\Post;
use App\Models\PostCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostCategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_crud_and_public_list_with_published_counts(): void
    {
        $admin = $this->adminWith(['news']);

        $created = $this->actingAs($admin)->postJson('/api/v1/admin/news-categories', ['name' => ['id' => 'Berita Perusahaan']])
            ->assertStatus(201)
            ->assertJsonPath('data.slug', 'berita-perusahaan')
            ->assertJsonPath('data.name.en', 'Berita Perusahaan')
            ->assertJsonPath('data.postCount', 0);
        $id = $created->json('data.id');

        // Nama sama -> slug diberi akhiran; nama kosong -> 422.
        $this->actingAs($admin)->postJson('/api/v1/admin/news-categories', ['name' => ['id' => 'Berita Perusahaan']])
            ->assertStatus(201)->assertJsonPath('data.slug', 'berita-perusahaan-2');
        $this->actingAs($admin)->postJson('/api/v1/admin/news-categories', ['name' => ['id' => '']])->assertStatus(422);

        Post::create(['slug' => 'a', 'title' => ['id' => 'A'], 'category_id' => $id, 'is_published' => true, 'published_at' => now()->subDay()]);
        Post::create(['slug' => 'b', 'title' => ['id' => 'B'], 'category_id' => $id, 'is_published' => false]);

        // Publik menghitung berita terbit saja; admin menghitung semua.
        $this->getJson('/api/v1/content/news-categories')->assertOk()->assertJsonPath('data.0.postCount', 1);
        $this->actingAs($admin)->getJson('/api/v1/admin/news-categories')->assertOk()->assertJsonPath('data.0.postCount', 2);

        // Filter daftar berita publik per slug kategori.
        $this->getJson('/api/v1/content/news?category=berita-perusahaan')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.category.slug', 'berita-perusahaan');
        $this->getJson('/api/v1/content/news?category=tidak-ada')->assertOk()->assertJsonCount(0, 'data');

        $this->actingAs($admin)->putJson("/api/v1/admin/news-categories/{$id}", ['name' => ['id' => 'Perusahaan', 'en' => 'Company'], 'slug' => 'perusahaan', 'sortOrder' => 5])
            ->assertOk()->assertJsonPath('data.slug', 'perusahaan')->assertJsonPath('data.sortOrder', 5);

        // Hapus kategori: berita tetap ada, kategorinya kosong.
        $this->actingAs($admin)->deleteJson("/api/v1/admin/news-categories/{$id}")->assertOk();
        $this->assertDatabaseMissing('post_categories', ['id' => $id]);
        $this->assertDatabaseHas('posts', ['slug' => 'a']);
        $this->assertNull(Post::where('slug', 'a')->firstOrFail()->category_id);
    }

    public function test_requires_news_module(): void
    {
        $gallery = $this->adminWith(['gallery']);

        $this->actingAs($gallery)->getJson('/api/v1/admin/news-categories')->assertStatus(403);
    }

    public function test_seeded_tags_are_migrated_to_categories(): void
    {
        // Migrasi create_post_categories memindahkan nilai tag lama menjadi kategori; di sini cukup pastikan seeder
        // memakai kategori dan relasi dibaca oleh resource.
        $this->seed(\Database\Seeders\ContentSeeder::class);

        $list = $this->getJson('/api/v1/content/news')->assertOk()->json('data');
        $this->assertNotEmpty($list);
        $this->assertSame('produk', $list[0]['category']['slug']);
        $this->assertGreaterThanOrEqual(3, PostCategory::count());
    }
}
