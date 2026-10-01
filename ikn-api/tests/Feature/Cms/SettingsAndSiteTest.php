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

    public function test_auth_slides_accept_images_and_videos_and_protect_media(): void
    {
        $admin = $this->adminWith(['settings']);
        $photo = \App\Models\Media::create(['disk' => 'public', 'path' => 'x/pabrik.jpg', 'original_name' => 'pabrik.jpg', 'mime' => 'image/jpeg', 'size' => 10]);
        $video = \App\Models\Media::create(['disk' => 'public', 'path' => 'x/produksi.mp4', 'original_name' => 'produksi.mp4', 'mime' => 'video/mp4', 'size' => 10]);
        $pdf = \App\Models\Media::create(['disk' => 'public', 'path' => 'x/brosur.pdf', 'original_name' => 'brosur.pdf', 'mime' => 'application/pdf', 'size' => 10]);

        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['auth' => ['slides' => [
            ['mediaId' => $photo->id, 'caption' => ['id' => 'Pabrik kami']],
            ['mediaId' => null],
            ['mediaId' => $video->id],
        ]]])->assertOk()
            ->assertJsonPath('data.auth.slides.0.media.id', $photo->id)
            ->assertJsonPath('data.auth.slides.0.caption.en', 'Pabrik kami')
            ->assertJsonPath('data.auth.slides.1.media.mime', 'video/mp4');
        $this->getJson('/api/v1/content/settings')->assertOk()->assertJsonCount(2, 'data.auth.slides');

        // Media yang dipakai slide tidak bisa dihapus; PDF ditolak sebagai slide.
        $this->actingAs($this->adminWith(['media']))->deleteJson('/api/v1/admin/media/'.$photo->id)->assertStatus(409);
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['auth' => ['slides' => [['mediaId' => $pdf->id]]]])
            ->assertStatus(422)->assertJsonStructure(['errors' => ['auth.slides']]);
    }

    public function test_whatsapp_contacts_are_normalised_and_validated(): void
    {
        $admin = $this->adminWith(['settings']);

        // Nomor dinormalkan ke 62…, baris kosong dibuang, tampil di settings publik.
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['contact' => ['whatsapp_contacts' => [
            ['label' => ' Marketing Resiprene ', 'number' => '0812-3456-7890'],
            ['label' => '', 'number' => ''],
            ['label' => 'Marketing Barang Karet', 'number' => '+62 811 648 0083'],
        ]]])->assertOk()
            ->assertJsonCount(2, 'data.contact.whatsapp_contacts')
            ->assertJsonPath('data.contact.whatsapp_contacts.0.label', 'Marketing Resiprene')
            ->assertJsonPath('data.contact.whatsapp_contacts.0.number', '6281234567890')
            ->assertJsonPath('data.contact.whatsapp_contacts.1.number', '628116480083');
        $this->getJson('/api/v1/content/settings')->assertOk()->assertJsonCount(2, 'data.contact.whatsapp_contacts');

        // Nomor terlalu pendek / ganda → 422; kosong = hapus semua.
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['contact' => ['whatsapp_contacts' => [['label' => 'A', 'number' => '0812']]]])
            ->assertStatus(422)->assertJsonValidationErrors(['contact.whatsapp_contacts']);
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['contact' => ['whatsapp_contacts' => [['label' => 'A', 'number' => '628111111111'], ['label' => 'B', 'number' => '08111111111']]]])
            ->assertStatus(422)->assertJsonValidationErrors(['contact.whatsapp_contacts']);
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['contact' => ['whatsapp_contacts' => []]])
            ->assertOk()->assertJsonCount(0, 'data.contact.whatsapp_contacts');
    }

    public function test_theme_colours_are_public_validated_and_resettable(): void
    {
        $this->getJson('/api/v1/content/settings')->assertOk()
            ->assertJsonPath('data.theme.primary', '#0b6fb8')
            ->assertJsonPath('data.theme.primary_deep', '#0a3f6b')
            ->assertJsonPath('data.theme.accent', '#1785cc');

        $admin = $this->adminWith(['settings']);

        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['theme' => ['primary' => 'biru']])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['theme.primary']);

        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['theme' => ['primary' => '#1E88E5', 'accent' => '']])
            ->assertOk()
            ->assertJsonPath('data.theme.primary', '#1e88e5')
            ->assertJsonPath('data.theme.accent', '')
            ->assertJsonPath('data.theme.primary_deep', '#0a3f6b');

        $this->getJson('/api/v1/content/settings')->assertJsonPath('data.theme.primary', '#1e88e5');
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
