<?php

namespace Tests\Feature\Admin;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_creates_admin_with_modules_and_audit_log(): void
    {
        $super = $this->superAdmin();

        $response = $this->actingAs($super)->postJson('/api/v1/admin/users', [
            'name' => 'Admin Konten',
            'email' => 'Konten@PTIKN.com',
            'password' => 'Rahasia123',
            'role' => 'admin',
            'permissions' => ['news', 'gallery'],
            'active' => true,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.email', 'konten@ptikn.com')
            ->assertJsonPath('data.permissions', ['news', 'gallery'])
            ->assertJsonPath('data.active', true);

        $this->assertDatabaseHas('users', ['email' => 'konten@ptikn.com', 'role' => User::ROLE_ADMIN]);
        $this->assertSame(1, AuditLog::where('user_id', $super->id)->where('action', 'like', 'POST %users%')->count());
    }

    public function test_unknown_module_is_rejected(): void
    {
        $this->actingAs($this->superAdmin())->postJson('/api/v1/admin/users', [
            'name' => 'X', 'email' => 'x@ptikn.com', 'password' => 'rahasia123', 'role' => 'admin', 'permissions' => ['nope'],
        ])->assertStatus(422)->assertJsonStructure(['errors' => ['permissions.0']]);
    }

    public function test_cannot_deactivate_self(): void
    {
        $super = $this->superAdmin();

        $this->actingAs($super)->putJson('/api/v1/admin/users/'.$super->id, ['active' => false])
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['active']]);
    }

    public function test_update_changes_role_permissions_and_password(): void
    {
        $super = $this->superAdmin();
        $admin = $this->adminWith(['news']);

        $this->actingAs($super)->putJson('/api/v1/admin/users/'.$admin->id, [
            'permissions' => ['cms'], 'password' => 'BaruBaru123', 'active' => false,
        ])->assertOk()->assertJsonPath('data.permissions', ['cms'])->assertJsonPath('data.active', false);

        $this->assertSame(User::STATUS_INACTIVE, $admin->fresh()->status);
    }

    public function test_customer_ids_are_not_manageable_here(): void
    {
        $customer = $this->customer();

        $this->actingAs($this->superAdmin())->putJson('/api/v1/admin/users/'.$customer->id, ['name' => 'X'])
            ->assertStatus(404);
    }
}
