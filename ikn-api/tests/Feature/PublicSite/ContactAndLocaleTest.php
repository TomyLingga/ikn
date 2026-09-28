<?php

namespace Tests\Feature\PublicSite;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactAndLocaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_contact_message_is_stored_and_admin_marks_it_read(): void
    {
        $this->postJson('/api/v1/contact', [
            'name' => 'Budi', 'email' => 'Budi@Example.com', 'subject' => 'Tanya', 'message' => 'Halo',
        ])->assertStatus(201)->assertJsonStructure(['data' => ['id'], 'message']);

        $admin = $this->adminWith(['messages']);
        $list = $this->actingAs($admin)->getJson('/api/v1/admin/contact-messages?unread=1')->assertOk();
        $this->assertSame(1, $list->json('meta.total'));
        $this->assertSame('budi@example.com', $list->json('data.0.email'));

        $this->actingAs($admin)->putJson('/api/v1/admin/contact-messages/'.$list->json('data.0.id').'/read')
            ->assertOk()->assertJsonStructure(['data' => ['readAt']]);

        $this->assertSame(0, $this->actingAs($admin)->getJson('/api/v1/admin/contact-messages?unread=1')->json('meta.total'));
    }

    public function test_validation_messages_follow_accept_language(): void
    {
        $en = $this->withHeaders(['Accept-Language' => 'en'])->postJson('/api/v1/contact', [])->assertStatus(422);
        $this->assertSame('The given data is invalid.', $en->json('message'));
        $this->assertStringContainsString('required', $en->json('errors.name.0'));

        $id = $this->withHeaders(['Accept-Language' => 'id'])->postJson('/api/v1/contact', [])->assertStatus(422);
        $this->assertSame('Data yang dikirim tidak valid.', $id->json('message'));
        $this->assertStringContainsString('wajib diisi', $id->json('errors.name.0'));

        // Default tanpa header = id.
        $default = $this->postJson('/api/v1/contact', [])->assertStatus(422);
        $this->assertStringContainsString('wajib diisi', $default->json('errors.name.0'));
    }
}
