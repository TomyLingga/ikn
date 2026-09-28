<?php

namespace Tests\Feature\Cms;

use App\Models\Menu;
use App\Models\Page;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsAndSiteTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_settings_have_defaults_and_hide_private_keys(): void
    {
        $response = $this->getJson('/api/v1/content/settings')->assertOk();

        $response->assertJsonPath('data.company.name', 'PT Industri Karet Nusantara');
        $this->assertArrayNotHasKey('admin', $response->json('data'));
    }

    public function test_admin_updates_nested_settings_and_ignores_unknown_keys(): void
    {
        $admin = $this->adminWith(['settings']);

        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', [
            'company' => ['name' => 'PT IKN Baru', 'tagline' => ['id' => 'Tagline baru']],
            'hacker' => ['key' => 'x'],
        ])->assertOk()
            ->assertJsonPath('data.company.name', 'PT IKN Baru')
            ->assertJsonPath('data.company.tagline.en', 'Tagline baru');

        $this->getJson('/api/v1/content/settings')->assertJsonPath('data.company.name', 'PT IKN Baru');
        $this->assertDatabaseMissing('settings', ['key' => 'hacker.key']);
    }

    public function test_site_bundle_returns_menus_contact_and_doc_links(): void
    {
        Menu::create(['location' => 'header'])->items()->create(['label' => ['id' => 'Beranda'], 'url' => '/']);
        $kontak = Page::create(['slug' => 'kontak', 'title' => ['id' => 'Kontak'], 'status' => 'published']);
        $kontak->sections()->create(['key' => 'contact-info', 'type' => 'contact_info', 'content' => [
            'emails' => [['address' => 'ikn@ptikn.com']],
        ]]);

        $response = $this->getJson('/api/v1/content/site')->assertOk();

        $response->assertJsonPath('data.menus.header.items.0.label.id', 'Beranda')
            ->assertJsonPath('data.menus.footer.items', [])
            ->assertJsonPath('data.contact.emails.0.address', 'ikn@ptikn.com')
            ->assertJsonPath('data.docLinks', []);
    }
}
