<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_login_with_stateful_session(): void
    {
        $admin = $this->superAdmin(['email' => 'Super@PTIKN.com']);

        $response = $this->fromFrontend()->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@ptikn.com',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.role', User::ROLE_SUPER_ADMIN)
            ->assertJsonPath('data.user.email', 'super@ptikn.com')
            ->assertJsonPath('data.user.permissions', ['*']);

        $this->assertAuthenticatedAs($admin, 'web');
        $this->assertNotNull($admin->fresh()->last_login_at);
    }

    public function test_wrong_password_returns_validation_error(): void
    {
        $this->superAdmin(['email' => 'super@ptikn.com']);

        $this->fromFrontend()->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@ptikn.com',
            'password' => 'salah',
        ])->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['errors' => ['email']]);

        $this->assertGuest('web');
    }

    public function test_customer_cannot_use_admin_login(): void
    {
        $this->customer(['email' => 'buyer@example.com']);

        $this->fromFrontend()->postJson('/api/v1/auth/admin/login', [
            'email' => 'buyer@example.com',
            'password' => 'password',
        ])->assertStatus(422);
    }

    public function test_inactive_admin_is_rejected(): void
    {
        User::factory()->superAdmin()->inactive()->create(['email' => 'off@ptikn.com']);

        $this->fromFrontend()->postJson('/api/v1/auth/admin/login', [
            'email' => 'off@ptikn.com',
            'password' => 'password',
        ])->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
    }

    public function test_login_without_frontend_origin_is_rejected(): void
    {
        $this->superAdmin(['email' => 'super@ptikn.com']);

        $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@ptikn.com',
            'password' => 'password',
        ])->assertStatus(400)->assertJsonPath('code', 'BAD_REQUEST');
    }

    public function test_login_is_rate_limited(): void
    {
        $this->superAdmin(['email' => 'super@ptikn.com']);

        for ($i = 0; $i < 5; $i++) {
            $this->fromFrontend()->postJson('/api/v1/auth/admin/login', ['email' => 'super@ptikn.com', 'password' => 'salah'])
                ->assertStatus(422);
        }

        $this->fromFrontend()->postJson('/api/v1/auth/admin/login', ['email' => 'super@ptikn.com', 'password' => 'salah'])
            ->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS');
    }

    public function test_me_and_logout(): void
    {
        $admin = $this->adminWith(['news', 'gallery']);

        $this->actingAs($admin)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.id', $admin->id)
            ->assertJsonPath('data.user.modules', ['news', 'gallery']);

        $this->fromFrontend()->actingAs($admin)->postJson('/api/v1/auth/logout')->assertOk();
        $this->assertGuest('web');

        // Guard di-cache per instance aplikasi test; lupakan agar request berikut benar-benar tamu.
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/auth/me')->assertStatus(401)->assertJsonPath('code', 'UNAUTHENTICATED');
    }
}
