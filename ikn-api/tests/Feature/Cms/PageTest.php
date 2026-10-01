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

    public function test_geo_field_is_validated_and_rounded(): void
    {
        $admin = $this->adminWith(['cms']);
        $page = \App\Models\Page::create(['slug' => 'kontak-uji', 'title' => ['id' => 'Kontak'], 'status' => 'published']);
        $location = ['name' => ['id' => 'Kantor'], 'address' => 'Jl. Medan', 'phones' => []];

        $this->actingAs($admin)->postJson("/api/v1/admin/pages/{$page->id}/sections", [
            'type' => 'contact_info',
            'content' => ['locations' => [$location + ['geo' => ['lat' => 120, 'lng' => 98.7]]], 'emails' => [], 'social' => []],
        ])->assertStatus(422)->assertJsonValidationErrors(['content.locations.0.geo.lat']);

        $created = $this->actingAs($admin)->postJson("/api/v1/admin/pages/{$page->id}/sections", [
            'type' => 'contact_info',
            'content' => ['locations' => [$location + ['geo' => ['lat' => '3.53871234567', 'lng' => 98.7467]], $location], 'emails' => [], 'social' => []],
        ])->assertStatus(201);

        $this->assertSame(3.538712, $created->json('data.content.locations.0.geo.lat'));
        $this->assertSame(['lat' => null, 'lng' => null], $created->json('data.content.locations.1.geo'));
        $this->assertNull($created->json('data.content.background'));
    }

    public function test_pages_index_is_sorted_by_title(): void
    {
        $admin = $this->adminWith(['cms']);
        \App\Models\Page::create(['slug' => 'aaa', 'title' => ['id' => 'Zebra'], 'status' => 'published']);
        \App\Models\Page::create(['slug' => 'zzz', 'title' => ['id' => 'alpha'], 'status' => 'published']);
        \App\Models\Page::create(['slug' => 'mmm', 'title' => ['id' => 'Beta'], 'status' => 'draft']);

        $titles = collect($this->actingAs($admin)->getJson('/api/v1/admin/pages')->assertOk()->json('data'))->pluck('title.id');

        $this->assertSame(['alpha', 'Beta', 'Zebra'], $titles->all());
    }

    public function test_contact_summary_section_is_available_for_tentang_page(): void
    {
        $admin = $this->adminWith(['cms']);
        $page = \App\Models\Page::create(['slug' => 'tentang', 'title' => ['id' => 'Tentang'], 'status' => 'published']);

        $this->actingAs($admin)->getJson('/api/v1/admin/cms/section-types')
            ->assertOk()
            ->assertJsonPath('data.types.contact_summary.pages', [])
            ->assertJsonPath('data.types.link_cards.pages', ['media', 'bisnis']);

        $created = $this->actingAs($admin)->postJson("/api/v1/admin/pages/{$page->id}/sections", [
            'type' => 'contact_summary',
            'content' => ['label' => ['id' => '/ Hubungi kami'], 'heading' => ['id' => 'Mari terhubung.'], 'button_label' => ['id' => 'Kirim pesan'], 'button_url' => '/kontak'],
        ])->assertStatus(201);

        $this->assertSame('/kontak', $created->json('data.content.button_url'));
        $this->assertSame('Mari terhubung.', $created->json('data.content.heading.en')); // en fallback dari id
        $this->getJson('/api/v1/content/pages/tentang')->assertOk()->assertJsonPath('data.sections.0.type', 'contact_summary');
    }

    public function test_section_types_endpoint_exposes_schema(): void
    {
        $response = $this->actingAs($this->adminWith(['cms']))->getJson('/api/v1/admin/cms/section-types')->assertOk();

        $this->assertArrayHasKey('timeline', $response->json('data.types'));
        $this->assertSame('list', $response->json('data.types.timeline.fields.items.type'));
        $this->assertContains('leaf', $response->json('data.icons'));
    }

    public function test_every_section_type_belongs_to_a_known_group(): void
    {
        $response = $this->actingAs($this->adminWith(['cms']))->getJson('/api/v1/admin/cms/section-types')->assertOk();

        $groups = array_keys($response->json('data.groups'));
        $this->assertSame(['header', 'content', 'showcase', 'data', 'contact'], $groups);
        foreach ($response->json('data.types') as $type => $definition) {
            $this->assertContains($definition['group'], $groups, "type {$type}");
        }
        foreach (['latest_news', 'steps', 'faq', 'spec_table', 'team', 'testimonials', 'image_grid'] as $type) {
            $this->assertArrayHasKey($type, $response->json('data.types'));
        }
        $response->assertJsonPath('data.types.faq.group', 'content')
            ->assertJsonPath('data.types.team.group', 'showcase')
            ->assertJsonPath('data.types.latest_news.group', 'data')
            ->assertJsonPath('data.types.stats.name.id', 'Angka kunci');
    }

    public function test_new_section_types_store_normalized_content(): void
    {
        $admin = $this->adminWith(['cms']);
        $page = \App\Models\Page::create(['slug' => 'profil', 'title' => ['id' => 'Profil'], 'status' => 'published']);
        $photo = \App\Models\Media::create(['disk' => 'public', 'path' => 'x/direktur.jpg', 'original_name' => 'direktur.jpg', 'mime' => 'image/jpeg', 'size' => 10]);
        $url = "/api/v1/admin/pages/{$page->id}/sections";

        $faq = $this->actingAs($admin)->postJson($url, ['type' => 'faq', 'key' => 'faq', 'content' => [
            'heading' => ['id' => 'Pertanyaan umum'],
            'items' => [['question' => ['id' => 'Berapa minimum order?'], 'answer' => ['id' => 'Mengikuti MOQ tiap produk.']]],
        ]])->assertStatus(201);
        $this->assertSame('Berapa minimum order?', $faq->json('data.content.items.0.question.en')); // en fallback dari id

        $this->actingAs($admin)->postJson($url, ['type' => 'steps', 'content' => [
            'items' => [['icon' => 'flask', 'title' => ['id' => 'Uji mutu'], 'body' => ['id' => 'Setiap batch diuji.']], ['title' => ['id' => 'Kirim']]],
        ]])->assertStatus(201)->assertJsonPath('data.content.items.1.icon', '');

        $this->actingAs($admin)->postJson($url, ['type' => 'spec_table', 'content' => [
            'rows' => [['label' => ['id' => 'Softening point'], 'value' => ['id' => '125-145 °C']]],
        ]])->assertStatus(201)->assertJsonPath('data.content.rows.0.value.id', '125-145 °C');

        $this->actingAs($admin)->postJson($url, ['type' => 'team', 'content' => [
            'items' => [['photo' => $photo->id, 'name' => 'Budi Santoso', 'position' => ['id' => 'Direktur']]],
        ]])->assertStatus(201)
            ->assertJsonPath('data.content.items.0.photo.id', $photo->id) // media dihidrasi menjadi ringkasan
            ->assertJsonPath('data.content.items.0.bio.id', '');

        $this->actingAs($admin)->postJson($url, ['type' => 'testimonials', 'content' => [
            'items' => [['quote' => ['id' => 'Mutu konsisten.'], 'name' => 'Sari Wulandari', 'company' => 'PT Cat Nusantara']],
        ]])->assertStatus(201)->assertJsonPath('data.content.items.0.photo', null);

        $this->actingAs($admin)->postJson($url, ['type' => 'image_grid', 'content' => [
            'items' => [['image' => $photo->id, 'caption' => ['id' => 'Lini produksi']]],
        ]])->assertStatus(201)->assertJsonPath('data.content.items.0.image.mime', 'image/jpeg');

        $this->actingAs($admin)->postJson($url, ['type' => 'latest_news', 'content' => ['count' => 4, 'link_url' => '/berita']])
            ->assertStatus(201)->assertJsonPath('data.content.count', 4);

        // Field wajib tetap divalidasi: jawaban FAQ kosong, foto kisi tanpa gambar.
        $this->actingAs($admin)->postJson($url, ['type' => 'faq', 'content' => ['items' => [['question' => ['id' => 'Tanpa jawaban?']]]]])
            ->assertStatus(422)->assertJsonValidationErrors(['content.items.0.answer.id']);
        $this->actingAs($admin)->postJson($url, ['type' => 'image_grid', 'content' => ['items' => [['caption' => ['id' => 'Tanpa foto']]]]])
            ->assertStatus(422)->assertJsonValidationErrors(['content.items.0.image']);

        $this->assertSame(
            ['faq', 'steps', 'spec_table', 'team', 'testimonials', 'image_grid', 'latest_news'],
            array_column($this->getJson('/api/v1/content/pages/profil')->assertOk()->json('data.sections'), 'type')
        );
    }

    public function test_icon_features_section_accepts_icon_or_image_and_validates_options(): void
    {
        $admin = $this->adminWith(['cms']);
        $page = \App\Models\Page::create(['slug' => 'keunggulan', 'title' => ['id' => 'Keunggulan'], 'status' => 'published']);
        $icon = \App\Models\Media::create(['disk' => 'public', 'path' => 'x/ikon.png', 'original_name' => 'ikon.png', 'mime' => 'image/png', 'size' => 10]);
        $url = "/api/v1/admin/pages/{$page->id}/sections";

        $this->actingAs($admin)->postJson($url, ['type' => 'icon_features', 'content' => [
            'heading' => ['id' => 'Mengapa Resiprene?'],
            'lead' => ['id' => 'Mutu yang bisa dipercaya.'],
            'columns' => '4',
            'items' => [
                ['icon' => 'microscope', 'title' => ['id' => 'Teruji laboratorium'], 'body' => ['id' => 'Setiap batch diuji.']],
                ['image' => $icon->id, 'title' => ['id' => 'Bahan pilihan']],
            ],
        ]])->assertStatus(201)
            ->assertJsonPath('data.content.items.0.icon', 'microscope')
            ->assertJsonPath('data.content.items.1.image.id', $icon->id)
            ->assertJsonPath('data.content.icon_style', '') // kosong = bawaan outline (FE)
            ->assertJsonPath('data.content.columns', '4');

        $this->actingAs($admin)->postJson($url, ['type' => 'icon_features', 'content' => [
            'columns' => '7', 'items' => [['icon' => 'tidak-ada', 'title' => ['id' => 'X']]],
        ]])->assertStatus(422)->assertJsonValidationErrors(['content.columns', 'content.items.0.icon']);

        $types = $this->getJson('/api/v1/admin/cms/section-types')->json('data');
        $this->assertArrayHasKey('icon_features', $types['types']);
        $this->assertContains('microscope', $types['icons']);
    }

    public function test_every_section_type_except_full_bleed_has_block_style_option(): void
    {
        $admin = $this->adminWith(['cms']);
        $types = $this->actingAs($admin)->getJson('/api/v1/admin/cms/section-types')->assertOk()->json('data.types');
        foreach ($types as $type => $definition) {
            $hasSurface = isset($definition['fields']['surface']);
            $this->assertSame(! in_array($type, \App\Services\Cms\SectionDefinitions::NO_SURFACE, true), $hasSurface, "type {$type}");
        }
        $this->assertSame(['plain', 'card', 'band'], array_keys($types['timeline']['fields']['surface']['options']));

        $page = \App\Models\Page::create(['slug' => 'blok', 'title' => ['id' => 'Blok'], 'status' => 'published']);
        $url = "/api/v1/admin/pages/{$page->id}/sections";
        $this->actingAs($admin)->postJson($url, ['type' => 'faq', 'content' => [
            'surface' => 'card', 'items' => [['question' => ['id' => 'Q?'], 'answer' => ['id' => 'A.']]],
        ]])->assertStatus(201)->assertJsonPath('data.content.surface', 'card');
        $this->actingAs($admin)->postJson($url, ['type' => 'faq', 'content' => [
            'surface' => 'glass', 'items' => [['question' => ['id' => 'Q?'], 'answer' => ['id' => 'A.']]],
        ]])->assertStatus(422)->assertJsonValidationErrors(['content.surface']);
    }

    public function test_text_visual_photo_side_and_cta_extras_are_validated(): void
    {
        $admin = $this->adminWith(['cms']);
        $page = \App\Models\Page::create(['slug' => 'bisnis', 'title' => ['id' => 'Bisnis'], 'status' => 'published']);
        $photo = \App\Models\Media::create(['disk' => 'public', 'path' => 'x/pabrik.jpg', 'original_name' => 'pabrik.jpg', 'mime' => 'image/jpeg', 'size' => 10]);
        $url = "/api/v1/admin/pages/{$page->id}/sections";

        $this->actingAs($admin)->postJson($url, ['type' => 'text_visual', 'content' => [
            'body' => ['id' => '<p>Pabrik kami.</p>'], 'image' => $photo->id, 'image_side' => 'left', 'image_alt' => ['id' => 'Pabrik'],
        ]])->assertStatus(201)
            ->assertJsonPath('data.content.image_side', 'left')
            ->assertJsonPath('data.content.image.id', $photo->id);

        $this->actingAs($admin)->postJson($url, ['type' => 'text_visual', 'content' => ['body' => ['id' => 'Teks'], 'image_side' => 'top']])
            ->assertStatus(422)->assertJsonValidationErrors(['content.image_side']);

        $this->actingAs($admin)->postJson($url, ['type' => 'cta', 'content' => [
            'title' => ['id' => 'Butuh penawaran?'], 'body' => ['id' => 'Tim kami membalas dalam satu hari kerja.'],
            'button_label' => ['id' => 'Hubungi kami'], 'button_url' => '/kontak',
            'secondary_label' => ['id' => 'Buka katalog'], 'secondary_url' => '/catalog', 'background' => $photo->id,
        ]])->assertStatus(201)
            ->assertJsonPath('data.content.secondary_url', '/catalog')
            ->assertJsonPath('data.content.background.id', $photo->id);
    }
}
