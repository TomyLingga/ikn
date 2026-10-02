<?php

namespace Tests\Feature\Cms;

use App\Models\Certificate;
use App\Models\Media;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CertificateTest extends TestCase
{
    use RefreshDatabase;

    private function media(string $mime, string $name): Media
    {
        return Media::create(['disk' => 'public', 'path' => 'certificates/'.$name, 'original_name' => $name, 'mime' => $mime, 'size' => 1000, 'collection' => 'certificates']);
    }

    public function test_admin_sets_certificate_file_and_logo_and_public_list_shows_them(): void
    {
        $pdf = $this->media('application/pdf', 'iso.pdf');
        $logo = $this->media('image/png', 'iso-logo.png');

        $this->actingAs($this->adminWith(['certificates']))->postJson('/api/v1/admin/certificates', [
            'name' => ['id' => 'ISO 37001:2016'],
            'mediaId' => $pdf->id,
            'logoMediaId' => $logo->id,
        ])->assertStatus(201)
            ->assertJsonPath('data.file.id', $pdf->id)
            ->assertJsonPath('data.logo.id', $logo->id)
            ->assertJsonPath('data.logo.mime', 'image/png');

        $this->getJson('/api/v1/content/certificates')
            ->assertOk()
            ->assertJsonPath('data.0.logo.id', $logo->id)
            ->assertJsonPath('data.0.file.mime', 'application/pdf');
    }

    public function test_certificate_file_must_be_pdf_and_logo_must_be_image(): void
    {
        $pdf = $this->media('application/pdf', 'a.pdf');
        $image = $this->media('image/jpeg', 'a.jpg');

        $this->actingAs($this->adminWith(['certificates']))->postJson('/api/v1/admin/certificates', [
            'name' => ['id' => 'REACH'],
            'mediaId' => $image->id,
            'logoMediaId' => $pdf->id,
        ])->assertStatus(422)->assertJsonValidationErrors(['mediaId', 'logoMediaId']);
    }

    public function test_logo_in_use_cannot_be_deleted_and_clearing_it_works(): void
    {
        $logo = $this->media('image/png', 'logo.png');
        $certificate = Certificate::create(['name' => ['id' => 'ISO'], 'logo_media_id' => $logo->id]);
        $admin = $this->superAdmin();

        $this->actingAs($admin)->deleteJson('/api/v1/admin/media/'.$logo->id)->assertStatus(409);

        $this->actingAs($admin)->putJson('/api/v1/admin/certificates/'.$certificate->id, ['name' => ['id' => 'ISO'], 'logoMediaId' => null])
            ->assertOk()->assertJsonPath('data.logo', null);
    }
}
