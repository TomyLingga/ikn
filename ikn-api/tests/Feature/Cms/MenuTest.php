<?php

namespace Tests\Feature\Cms;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MenuTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_replaces_header_tree_and_public_gets_active_items_only(): void
    {
        $admin = $this->adminWith(['cms']);

        $this->actingAs($admin)->putJson('/api/v1/admin/menus/header', ['items' => [
            ['key' => 'home', 'label' => ['id' => 'Beranda', 'en' => 'Home'], 'url' => '/'],
            ['key' => 'tentang', 'label' => ['id' => 'Tentang Kami', 'en' => 'About Us'], 'url' => '/tentang', 'children' => [
                ['label' => ['id' => 'Sejarah', 'en' => 'History'], 'url' => '/tentang#sejarah', 'description' => ['id' => 'Sejak 1965']],
                ['label' => ['id' => 'Rahasia'], 'url' => '/rahasia', 'isActive' => false],
            ]],
        ]])->assertOk()->assertJsonPath('data.items.1.children.0.label.en', 'History');

        $public = $this->getJson('/api/v1/content/menus/header')->assertOk();
        $this->assertCount(2, $public->json('data.items'));
        $this->assertCount(1, $public->json('data.items.1.children'));
        $public->assertJsonPath('data.items.1.key', 'tentang')
            ->assertJsonPath('data.items.1.children.0.description.en', 'Sejak 1965');
    }

    public function test_label_id_is_required(): void
    {
        $this->actingAs($this->adminWith(['cms']))->putJson('/api/v1/admin/menus/header', ['items' => [
            ['label' => ['en' => 'Home only'], 'url' => '/'],
        ]])->assertStatus(422)->assertJsonStructure(['errors' => ['items.0.label.id']]);
    }

    public function test_unknown_location_is_not_found(): void
    {
        $this->actingAs($this->adminWith(['cms']))->getJson('/api/v1/admin/menus/sidebar')->assertStatus(404);
        $this->getJson('/api/v1/content/menus/sidebar')->assertStatus(404);
    }
}
