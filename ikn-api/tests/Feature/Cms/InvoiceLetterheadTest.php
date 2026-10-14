<?php

namespace Tests\Feature\Cms;

use App\Models\Media;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Kop & kaki cetakan invoice dari gambar (ASUMSI A-83): setting media publik, hanya gambar, dilindungi dari hapus.
class InvoiceLetterheadTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_letterhead_images_are_public_image_only_and_protected(): void
    {
        $admin = $this->adminWith(['settings']);
        $header = Media::create(['disk' => 'public', 'path' => 'x/kop.png', 'original_name' => 'kop.png', 'mime' => 'image/png', 'size' => 10]);
        $pdf = Media::create(['disk' => 'public', 'path' => 'x/kop.pdf', 'original_name' => 'kop.pdf', 'mime' => 'application/pdf', 'size' => 10]);

        $this->getJson('/api/v1/content/settings')->assertOk()
            ->assertJsonPath('data.invoice.header_image', null)
            ->assertJsonPath('data.invoice.footer_image', null);

        // PDF ditolak; gambar diterima dan tampil publik (dipakai halaman cetak).
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['invoice' => ['header_image' => $pdf->id]])
            ->assertStatus(422)->assertJsonValidationErrors(['invoice.header_image']);
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['invoice' => ['header_image' => $header->id, 'footer_image' => null]])
            ->assertOk()
            ->assertJsonPath('data.invoice.header_image.id', $header->id)
            ->assertJsonPath('data.invoice.footer_image', null);
        $this->getJson('/api/v1/content/settings')->assertOk()->assertJsonPath('data.invoice.header_image.originalName', 'kop.png');

        // Media yang dipakai kop tidak bisa dihapus; setelah dilepas boleh.
        $this->actingAs($this->adminWith(['media']))->deleteJson('/api/v1/admin/media/'.$header->id)->assertStatus(409);
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['invoice' => ['header_image' => '']])
            ->assertOk()->assertJsonPath('data.invoice.header_image', null);
        $this->actingAs($this->adminWith(['media']))->deleteJson('/api/v1/admin/media/'.$header->id)->assertOk();
    }
}
