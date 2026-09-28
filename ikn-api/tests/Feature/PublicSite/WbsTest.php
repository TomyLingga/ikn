<?php

namespace Tests\Feature\PublicSite;

use App\Models\WbsReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WbsTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_report_gets_sequential_code_and_hides_identity(): void
    {
        $first = $this->postJson('/api/v1/wbs', ['subject' => 'Dugaan gratifikasi', 'body' => 'Uraian lengkap kejadian.', 'isAnonymous' => true])
            ->assertStatus(201);

        $this->assertMatchesRegularExpression('/^WBS-\d{6}-0001$/', $first->json('data.code'));

        $second = $this->postJson('/api/v1/wbs', ['subject' => 'Kedua', 'body' => 'Isi', 'anonymous' => true])->assertStatus(201);
        $this->assertStringEndsWith('-0002', $second->json('data.code'));

        $status = $this->getJson('/api/v1/wbs/'.$first->json('data.code'))->assertOk()
            ->assertJsonPath('data.status', WbsReport::STATUS_NEW);
        $this->assertArrayNotHasKey('body', $status->json('data'));
    }

    public function test_non_anonymous_report_requires_contact(): void
    {
        $this->postJson('/api/v1/wbs', ['subject' => 'X', 'body' => 'Y', 'isAnonymous' => false])
            ->assertStatus(422)->assertJsonStructure(['errors' => ['reporterContact']]);

        $this->postJson('/api/v1/wbs', ['subject' => 'X', 'body' => 'Y', 'anonymous' => false, 'contact' => 'pelapor@mail.com'])
            ->assertStatus(201);

        $this->assertDatabaseHas('wbs_reports', ['reporter_contact' => 'pelapor@mail.com', 'is_anonymous' => false]);
    }

    public function test_attachment_is_stored_privately_and_visible_to_admin(): void
    {
        Storage::fake('private');

        $response = $this->post('/api/v1/wbs', [
            'subject' => 'Dengan lampiran', 'body' => 'Isi', 'isAnonymous' => true,
            'attachment' => UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf'),
        ])->assertStatus(201);

        $report = WbsReport::where('code', $response->json('data.code'))->first();
        $this->assertNotNull($report->attachment_media_id);
        $this->assertSame('private', $report->attachment->disk);
        Storage::disk('private')->assertExists($report->attachment->path);

        $admin = $this->adminWith(['wbs']);
        $this->actingAs($admin)->getJson('/api/v1/admin/whistleblowing/'.$report->id)->assertOk()
            ->assertJsonPath('data.attachment.id', $report->attachment_media_id);

        $this->actingAs($admin)->putJson('/api/v1/admin/whistleblowing/'.$report->id, ['status' => 'review', 'adminNotes' => 'Ditindaklanjuti'])
            ->assertOk()->assertJsonPath('data.status', 'review')->assertJsonPath('data.handledBy.id', $admin->id);
    }

    public function test_public_form_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/wbs', ['subject' => "S$i", 'body' => 'B', 'isAnonymous' => true])->assertStatus(201);
        }

        $this->postJson('/api/v1/wbs', ['subject' => 'S6', 'body' => 'B', 'isAnonymous' => true])->assertStatus(429);
    }
}
