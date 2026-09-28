<?php

namespace Tests\Feature\Admin;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModuleAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_without_module_is_forbidden(): void
    {
        $admin = $this->adminWith(['news']);

        $this->actingAs($admin)->getJson('/api/v1/admin/news')->assertOk();
        $this->actingAs($admin)->getJson('/api/v1/admin/gallery')
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN');
    }

    public function test_super_admin_has_every_module(): void
    {
        $super = $this->superAdmin();

        $this->actingAs($super)->getJson('/api/v1/admin/gallery')->assertOk();

        $response = $this->actingAs($super)->getJson('/api/v1/admin/permissions/self')->assertOk();
        $this->assertContains('cms', $response->json('data.modules'));
        $this->assertContains('users', $response->json('data.modules'));
    }

    public function test_customer_cannot_reach_admin(): void
    {
        $this->actingAs($this->customer())->getJson('/api/v1/admin/permissions/self')->assertStatus(403);
    }

    public function test_guest_cannot_reach_admin(): void
    {
        $this->getJson('/api/v1/admin/permissions/self')->assertStatus(401)->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_only_super_admin_manages_users(): void
    {
        $admin = $this->adminWith(['users']);

        $this->actingAs($admin)->getJson('/api/v1/admin/users')->assertStatus(403);
        $this->actingAs($this->superAdmin())->getJson('/api/v1/admin/users')->assertOk();
    }
}
