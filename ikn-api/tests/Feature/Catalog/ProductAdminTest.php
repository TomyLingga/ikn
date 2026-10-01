<?php

namespace Tests\Feature\Catalog;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Support\CatalogFixtures;
use Tests\TestCase;

// Kontrak 11.3 (kategori, produk, gambar, ulasan) + katalog publik bagian 6.
class ProductAdminTest extends TestCase
{
    use RefreshDatabase, CatalogFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_admin_creates_product_with_images_and_it_is_served_publicly(): void
    {
        $category = $this->makeCategory(['slug' => 'resiprene', 'name' => ['id' => 'Resiprene']]);
        $first = $this->makeMedia('a.jpg');
        $second = $this->makeMedia('b.jpg');

        $response = $this->actingAs($this->adminWith(['products']))->postJson('/api/v1/admin/products', [
            'code' => 'RSP-35',
            'categoryId' => $category->id,
            'name' => ['id' => 'Resiprene 35'],
            'kind' => 'Cyclised Natural Rubber',
            'priceMode' => 'fixed',
            'price' => 185000,
            'unit' => 'kg',
            'moq' => 25,
            'weightGram' => 1000,
            'lengthCm' => 40,
            'widthCm' => 30.25,
            'heightCm' => 25,
            'highlights' => ['Cepat kering', 'Tahan air'],
            'specs' => [['Softening Point', '125–145 °C'], ['', '']],
            'applications' => ['id' => ['Protective coatings'], 'en' => ['Protective coatings']],
            'solubility' => [['White spirit', 'Sempurna']],
            'aliases' => ['resiprine', ' karet siklis '],
            'isPublished' => true,
            'images' => [$second->id, $first->id],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.slug', 'resiprene-35')
            ->assertJsonPath('data.name.en', 'Resiprene 35')
            ->assertJsonPath('data.price', 185000)
            ->assertJsonPath('data.effectivePrice', 185000)
            ->assertJsonPath('data.promoPrice', null)
            ->assertJsonPath('data.stock', 0)
            ->assertJsonPath('data.available', 0)
            ->assertJsonPath('data.stockStatus', 'out_of_stock')
            ->assertJsonPath('data.highlights.en.0', 'Cepat kering')
            ->assertJsonPath('data.specs', [['Softening Point', '125–145 °C']])
            ->assertJsonPath('data.aliases', ['resiprine', 'karet siklis'])
            ->assertJsonPath('data.images.0.id', $second->id)
            ->assertJsonPath('data.images.0.sort', 0)
            ->assertJsonPath('data.images.1.id', $first->id)
            ->assertJsonPath('data.category.slug', 'resiprene')
            ->assertJsonPath('data.dimensions.widthCm', 30.3)
            ->assertJsonPath('data.dimensions.volumeCm3', 30300);

        $this->assertIsInt($response->json('data.price'));
        $this->assertStringContainsString('/storage/', $response->json('data.image'));

        $public = $this->getJson('/api/v1/catalog/products/resiprene-35')->assertOk();
        $public->assertJsonPath('data.code', 'RSP-35')
            ->assertJsonPath('data.category.name.id', 'Resiprene')
            ->assertJsonPath('data.reviews', [])
            ->assertJsonPath('data.related', [])
            ->assertJsonCount(2, 'data.images');
        $this->assertArrayNotHasKey('isPublished', $public->json('data'));

        $this->getJson('/api/v1/catalog/products')->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.slug', 'resiprene-35');
    }

    public function test_update_replaces_images_and_quote_mode_clears_price(): void
    {
        $product = $this->makeProduct(['slug' => 'egrek', 'price' => 125000]);
        $old = $this->makeMedia('old.jpg');
        $new = $this->makeMedia('new.jpg');
        $product->images()->create(['media_id' => $old->id, 'sort_order' => 0]);

        $this->actingAs($this->superAdmin())->putJson('/api/v1/admin/products/'.$product->id, [
            'code' => $product->code,
            'categoryId' => $product->category_id,
            'name' => ['id' => 'Sarung Egrek', 'en' => 'Sickle Cover'],
            'priceMode' => 'quote',
            'images' => [$new->id],
        ])->assertOk()
            ->assertJsonPath('data.priceMode', 'quote')
            ->assertJsonPath('data.price', null)
            ->assertJsonPath('data.effectivePrice', null)
            ->assertJsonCount(1, 'data.images')
            ->assertJsonPath('data.images.0.id', $new->id);

        $this->assertDatabaseMissing('product_images', ['product_id' => $product->id, 'media_id' => $old->id]);
        $this->assertDatabaseHas('media', ['id' => $old->id]); // media tidak dihapus, hanya dilepas
    }

    public function test_product_media_accepts_videos_and_admin_picks_the_thumbnail(): void
    {
        $admin = $this->adminWith(['products']);
        $product = $this->makeProduct(['slug' => 'sarung-egrek']);
        $front = $this->makeMedia('depan.jpg');
        $side = $this->makeMedia('samping.jpg');
        $video = \App\Models\Media::create([
            'disk' => 'public', 'path' => 'products/demo.mp4', 'original_name' => 'demo.mp4', 'mime' => 'video/mp4', 'size' => 9999, 'collection' => 'products',
        ]);
        $pdf = \App\Models\Media::create([
            'disk' => 'public', 'path' => 'documents/brosur.pdf', 'original_name' => 'brosur.pdf', 'mime' => 'application/pdf', 'size' => 9999, 'collection' => 'documents',
        ]);
        $base = [
            'code' => $product->code, 'categoryId' => $product->category_id, 'name' => ['id' => 'Sarung Egrek'],
            'priceMode' => 'fixed', 'price' => 100000,
        ];
        $url = '/api/v1/admin/products/'.$product->id;

        // Video di urutan pertama: thumbnail tetap foto (pilihan admin).
        $this->actingAs($admin)->putJson($url, $base + ['images' => [$video->id, $front->id, $side->id], 'thumbnailMediaId' => $side->id])
            ->assertOk()
            ->assertJsonCount(3, 'data.images')
            ->assertJsonPath('data.images.0.type', 'video')
            ->assertJsonPath('data.images.0.mime', 'video/mp4')
            ->assertJsonPath('data.images.0.isThumbnail', false)
            ->assertJsonPath('data.images.2.isThumbnail', true)
            ->assertJsonPath('data.thumbnailMediaId', $side->id)
            ->assertJsonPath('data.image', $side->url())
            ->assertJsonPath('data.hasVideo', true);
        $this->assertSame($side->url(), $product->fresh()->primaryImageUrl());

        $this->getJson('/api/v1/catalog/products/sarung-egrek')
            ->assertOk()->assertJsonPath('data.image', $side->url())->assertJsonPath('data.images.0.type', 'video')->assertJsonPath('data.images.1.type', 'image');

        // Tanpa thumbnailMediaId: tanda yang ada dipertahankan walau urutan berubah.
        $this->actingAs($admin)->putJson($url, $base + ['images' => [$front->id, $side->id, $video->id]])
            ->assertOk()->assertJsonPath('data.thumbnailMediaId', $side->id)->assertJsonPath('data.images.1.isThumbnail', true);
        // thumbnailMediaId null: kembali ke foto pertama.
        $this->actingAs($admin)->putJson($url, $base + ['images' => [$video->id, $front->id, $side->id], 'thumbnailMediaId' => null])
            ->assertOk()->assertJsonPath('data.thumbnailMediaId', $front->id)->assertJsonPath('data.image', $front->url());
        // Hanya video: tidak ada thumbnail.
        $this->actingAs($admin)->putJson($url, $base + ['images' => [$video->id]])
            ->assertOk()->assertJsonPath('data.image', null)->assertJsonPath('data.thumbnailMediaId', null);

        // Thumbnail harus foto di dalam daftar; dokumen bukan media produk.
        $this->actingAs($admin)->putJson($url, $base + ['images' => [$video->id, $front->id], 'thumbnailMediaId' => $video->id])
            ->assertStatus(422)->assertJsonValidationErrors(['thumbnailMediaId']);
        $this->actingAs($admin)->putJson($url, $base + ['images' => [$front->id], 'thumbnailMediaId' => $side->id])
            ->assertStatus(422)->assertJsonValidationErrors(['thumbnailMediaId']);
        $this->actingAs($admin)->putJson($url, $base + ['images' => [$front->id, $pdf->id]])
            ->assertStatus(422)->assertJsonValidationErrors(['images.1']);
    }

    public function test_unpublished_and_soft_deleted_products_are_hidden_from_public(): void
    {
        $draft = $this->makeProduct(['slug' => 'draft', 'is_published' => false]);
        $deleted = $this->makeProduct(['slug' => 'lama']);
        $live = $this->makeProduct(['slug' => 'tayang']);

        $this->actingAs($this->adminWith(['products']))->deleteJson('/api/v1/admin/products/'.$deleted->id)->assertOk();
        $this->assertSoftDeleted('products', ['id' => $deleted->id]);

        $list = $this->getJson('/api/v1/catalog/products')->assertOk();
        $this->assertSame(['tayang'], array_column($list->json('data'), 'slug'));
        $this->getJson('/api/v1/catalog/products/draft')->assertStatus(404)->assertJsonPath('code', 'NOT_FOUND');
        $this->getJson('/api/v1/catalog/products/lama')->assertStatus(404);

        // Admin melihat draf; publish lewat endpoint khusus.
        $this->actingAs($this->adminWith(['products']))->getJson('/api/v1/admin/products?published=0')->assertOk()->assertJsonPath('meta.total', 1);
        $this->actingAs($this->adminWith(['products']))->putJson('/api/v1/admin/products/'.$draft->id.'/publish', ['isPublished' => true])
            ->assertOk()->assertJsonPath('data.isPublished', true);
        $this->getJson('/api/v1/catalog/products/draft')->assertOk();
        $this->getJson('/api/v1/catalog/products/tayang')->assertOk()->assertJsonCount(1, 'data.related');
    }

    public function test_search_q_is_case_insensitive_on_name_code_and_aliases(): void
    {
        $this->makeProduct(['slug' => 'resiprene-35', 'code' => 'RSP-35', 'name' => ['id' => 'Resiprene 35'], 'aliases' => ['karet siklis']]);
        $this->makeProduct(['slug' => 'sepatu-boots', 'code' => 'IKN-PRD-002', 'name' => ['id' => 'Sepatu Boots', 'en' => 'Industrial Rubber Boots']]);

        $this->getJson('/api/v1/catalog/products?q=RESIP')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.slug', 'resiprene-35');
        $this->getJson('/api/v1/catalog/products?q=Siklis')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.slug', 'resiprene-35');
        $this->getJson('/api/v1/catalog/products?q=rubber')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.slug', 'sepatu-boots');
        $this->getJson('/api/v1/catalog/products?q=ikn-prd')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/catalog/products?q=tidakada')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/catalog/products?sort=name')->assertOk()->assertJsonPath('data.0.slug', 'resiprene-35');
        $this->actingAs($this->adminWith(['products']))->getJson('/api/v1/admin/products?q=boots')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_category_with_products_cannot_be_deleted(): void
    {
        $category = $this->makeCategory(['slug' => 'rubber-articles']);
        $empty = $this->makeCategory(['slug' => 'kosong']);
        $product = $this->makeProduct([], 0, $category);
        $admin = $this->adminWith(['categories']);

        $this->actingAs($admin)->deleteJson('/api/v1/admin/categories/'.$category->id)
            ->assertStatus(409)->assertJsonPath('code', 'CATEGORY_IN_USE');

        // Produk yang sudah soft-delete pun tetap merujuk kategori.
        $product->delete();
        $this->actingAs($admin)->deleteJson('/api/v1/admin/categories/'.$category->id)->assertStatus(409);

        $this->actingAs($admin)->deleteJson('/api/v1/admin/categories/'.$empty->id)->assertOk()->assertJsonPath('data.deleted', true);
        $this->assertDatabaseMissing('categories', ['id' => $empty->id]);
    }

    public function test_public_categories_only_active_with_published_product_count(): void
    {
        $active = $this->makeCategory(['slug' => 'aktif']);
        $this->makeCategory(['slug' => 'nonaktif', 'is_active' => false]);
        $this->makeProduct([], 0, $active);
        $this->makeProduct(['is_published' => false], 0, $active);

        $this->getJson('/api/v1/catalog/categories')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.slug', 'aktif')
            ->assertJsonPath('data.0.productCount', 1);

        $this->actingAs($this->adminWith(['categories']))->postJson('/api/v1/admin/categories', ['name' => ['id' => 'Barang Karet']])
            ->assertStatus(201)->assertJsonPath('data.slug', 'barang-karet')->assertJsonPath('data.name.en', 'Barang Karet');
    }

    public function test_media_used_by_product_cannot_be_deleted(): void
    {
        $media = $this->makeMedia('dipakai.jpg');
        $product = $this->makeProduct();
        $product->images()->create(['media_id' => $media->id, 'sort_order' => 0]);

        $this->actingAs($this->superAdmin())->deleteJson('/api/v1/admin/media/'.$media->id)
            ->assertStatus(409)->assertJsonPath('code', 'MEDIA_IN_USE');
        $this->assertDatabaseHas('media', ['id' => $media->id]);
    }

    public function test_products_module_is_required_and_reviews_can_be_moderated(): void
    {
        $product = $this->makeProduct(['slug' => 'resiprene-35']);
        $review = $product->reviews()->create(['user_id' => $this->customer()->id, 'rating' => 5, 'body' => 'Bagus', 'is_published' => true]);
        $this->assertSame(1, $product->fresh()->review_count);

        $this->getJson('/api/v1/admin/products')->assertStatus(401);
        $this->actingAs($this->adminWith(['cms']))->getJson('/api/v1/admin/products')->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');

        $this->actingAs($this->adminWith(['products']))->putJson('/api/v1/admin/reviews/'.$review->id, ['isPublished' => false])
            ->assertOk()->assertJsonPath('data.isPublished', false);

        $fresh = $product->fresh();
        $this->assertSame(0, $fresh->review_count);
        $this->assertSame(0.0, (float) $fresh->rating_avg);
        $this->getJson('/api/v1/catalog/products/resiprene-35/reviews')->assertOk()->assertJsonPath('meta.total', 0);
        $this->actingAs($this->adminWith(['products']))->getJson('/api/v1/admin/reviews?published=0')->assertOk()->assertJsonPath('meta.total', 1);
    }
}
