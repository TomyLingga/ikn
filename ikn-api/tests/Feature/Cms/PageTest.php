<?php

namespace Tests\Feature\Cms;

use App\Models\AuditLog;
use App\Models\Page;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PageTest extends TestCase
{
    use RefreshDatabase;

    private function tentang(string $status = Page::STATUS_PUBLISHED): Page
    {
        $page = Page::create(['slug' => 'tentang', 'title' => ['id' => 'Tentang Kami', 'en' => 'About Us'], 'status' => $status]);
        $page->sections()->create(['key' => 'history', 'type' => 'timeline', 'sort_order' => 0, 'content' => [
            'label' => ['id' => '/ Perjalanan'], 'heading' => ['id' => 'Jejak singkat.'],
            'items' => [['year' => '1965', 'title' => ['id' => 'Titik awal'], 'body' => ['id' => 'Mulai beroperasi.']]],
        ]]);
        $page->sections()->create(['key' => 'hidden', 'type' => 'rich_text', 'sort_order' => 1, 'is_visible' => false, 'content' => [
            'body' => ['id' => 'Tersembunyi'],
        ]]);

        return $page;
    }

    public function test_public_page_hides_invisible_sections_and_fills_english_fallback(): void
    {
        $this->tentang();

        $response = $this->getJson('/api/v1/content/pages/tentang')->assertOk();

        $this->assertCount(1, $response->json('data.sections'));
        $response->assertJsonPath('data.sections.0.type', 'timeline')
            ->assertJsonPath('data.sections.0.content.items.0.title.en', 'Titik awal')
            ->assertJsonPath('data.title.en', 'About Us')
            ->assertJsonPath('data.seo.title.id', 'Tentang Kami');
    }

    public function test_draft_page_is_not_public_but_visible_to_admin(): void
    {
        $page = $this->tentang(Page::STATUS_DRAFT);

        $this->getJson('/api/v1/content/pages/tentang')->assertStatus(404);
        $this->actingAs($this->adminWith(['cms']))->getJson('/api/v1/admin/pages/'.$page->id)
            ->assertOk()->assertJsonCount(2, 'data.sections');
    }

    public function test_block_alias_reads_history_section(): void
    {
        $this->tentang();

        $this->getJson('/api/v1/content/blocks/history')->assertOk()
            ->assertJsonPath('data.type', 'timeline')
            ->assertJsonPath('data.data.items.0.year', '1965');
    }

    public function test_unknown_section_type_is_rejected(): void
    {
        $page = $this->tentang();

        $this->actingAs($this->adminWith(['cms']))->postJson("/api/v1/admin/pages/{$page->id}/sections", [
            'type' => 'carousel_3d', 'content' => [],
        ])->assertStatus(422)->assertJsonPath('code', 'VALIDATION_ERROR');
    }

    public function test_section_content_is_validated_against_schema(): void
    {
        $page = $this->tentang();
        $admin = $this->adminWith(['cms']);

        $this->actingAs($admin)->postJson("/api/v1/admin/pages/{$page->id}/sections", [
            'type' => 'timeline',
            'content' => ['items' => [['year' => '', 'title' => ['id' => '']]]],
        ])->assertStatus(422)->assertJsonStructure(['errors' => ['content.items.0.year', 'content.items.0.title.id']]);

        $response = $this->actingAs($admin)->postJson("/api/v1/admin/pages/{$page->id}/sections", [
            'type' => 'stats', 'key' => 'stats',
            'content' => ['items' => [['value' => '60', 'unit' => 'Thn', 'label' => ['id' => 'Pengalaman']]]],
        ])->assertStatus(201);

        $response->assertJsonPath('data.content.items.0.label.en', 'Pengalaman')
            ->assertJsonPath('data.sortOrder', 2);

        $this->assertTrue(AuditLog::where('action', 'like', 'POST %sections')->exists());
    }

    public function test_hero_meta_colour_is_validated_and_buttons_are_a_list(): void
    {
        $admin = $this->adminWith(['cms']);
        $page = \App\Models\Page::create(['slug' => 'hero-uji', 'title' => ['id' => 'Uji'], 'status' => 'published']);
        $base = ['title' => ['id' => "Baris 1\nBaris 2"], 'slides' => [], 'subtitle' => ['id' => '']];

        // Warna bukan hex -> 422 pada field yang tepat.
        $this->actingAs($admin)->postJson("/api/v1/admin/pages/{$page->id}/sections", [
            'type' => 'hero',
            'content' => $base + ['meta' => [['text' => ['id' => 'Sejak 1965'], 'color' => 'hijau']], 'buttons' => []],
        ])->assertStatus(422)->assertJsonValidationErrors(['content.meta.0.color']);

        // Hex valid disimpan lowercase; tanpa tombol boleh; maksimal 3 tombol.
        $created = $this->actingAs($admin)->postJson("/api/v1/admin/pages/{$page->id}/sections", [
            'type' => 'hero',
            'content' => $base + ['meta' => [['text' => ['id' => 'Sejak 1965'], 'color' => '#8FD1A6'], ['text' => ['id' => 'Medan']]], 'buttons' => []],
        ])->assertStatus(201);
        $this->assertSame('#8fd1a6', $created->json('data.content.meta.0.color'));
        $this->assertSame('', $created->json('data.content.meta.1.color'));
        $this->assertSame([], $created->json('data.content.buttons'));

        $four = array_fill(0, 4, ['label' => ['id' => 'Tombol'], 'url' => '/produk', 'style' => 'solid']);
        $this->actingAs($admin)->putJson('/api/v1/admin/sections/'.$created->json('data.id'), ['content' => $base + ['meta' => [], 'buttons' => $four]])
            ->assertStatus(422)->assertJsonValidationErrors(['content.buttons']);

        $this->actingAs($admin)->putJson('/api/v1/admin/sections/'.$created->json('data.id'), ['content' => $base + ['meta' => [], 'buttons' => array_slice($four, 0, 2)]])
            ->assertOk()->assertJsonPath('data.content.buttons.1.style', 'solid')->assertJsonPath('data.content.buttons.1.profile_document', false);
    }

    public function test_reorder_and_toggle_visibility(): void
    {
        $page = $this->tentang();
        $admin = $this->adminWith(['cms']);
        [$first, $second] = $page->sections()->pluck('id')->all();

        $this->actingAs($admin)->putJson("/api/v1/admin/pages/{$page->id}/sections/reorder", ['ids' => [$second, $first]])
            ->assertOk()
            ->assertJsonPath('data.sections.0.id', $second)
            ->assertJsonPath('data.sections.1.id', $first);

        $this->actingAs($admin)->putJson('/api/v1/admin/sections/'.$second, ['isVisible' => true])->assertOk();

        $this->assertCount(2, $this->getJson('/api/v1/content/pages/tentang')->json('data.sections'));
    }

    public function test_reorder_rejects_foreign_section_ids(): void
    {
        $page = $this->tentang();
        $other = Page::create(['slug' => 'lain', 'title' => ['id' => 'Lain'], 'status' => 'draft']);
        $foreign = $other->sections()->create(['type' => 'rich_text', 'content' => ['body' => ['id' => 'x']]]);

        $this->actingAs($this->adminWith(['cms']))->putJson("/api/v1/admin/pages/{$page->id}/sections/reorder", ['ids' => [$foreign->id]])
            ->assertStatus(422);
    }

    public function test_protected_page_slug_cannot_change_or_be_deleted(): void
    {
        $page = $this->tentang();
        $admin = $this->adminWith(['cms']);

        $this->actingAs($admin)->putJson('/api/v1/admin/pages/'.$page->id, ['slug' => 'about'])
            ->assertStatus(409)->assertJsonPath('code', 'PAGE_PROTECTED');
        $this->actingAs($admin)->deleteJson('/api/v1/admin/pages/'.$page->id)->assertStatus(409);

        $this->actingAs($admin)->putJson('/api/v1/admin/pages/'.$page->id, ['title' => ['id' => 'Profil', 'en' => 'Profile']])
            ->assertOk()->assertJsonPath('data.title.en', 'Profile');
    }

    public function test_section_types_endpoint_exposes_schema(): void
    {
        $response = $this->actingAs($this->adminWith(['cms']))->getJson('/api/v1/admin/cms/section-types')->assertOk();

        $this->assertArrayHasKey('timeline', $response->json('data.types'));
        $this->assertSame('list', $response->json('data.types.timeline.fields.items.type'));
        $this->assertContains('leaf', $response->json('data.icons'));
    }
}
