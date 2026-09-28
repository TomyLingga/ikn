<?php

namespace Tests\Feature\Account;

use App\Mail\Account\AccountApproved;
use App\Mail\Account\VerifyEmail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Route dummy ber-middleware customer.active (pengganti checkout yang dibuat BE-3).
        Route::middleware(['api', 'auth:sanctum', 'customer.active'])
            ->get('api/v1/_test/customer-active', fn () => response()->json(['data' => ['ok' => true]]));
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Budi Santoso',
            'email' => 'Buyer@CoatingSolutions.co.id',
            'password' => 'Rahasia123',
            'passwordConfirmation' => 'Rahasia123',
            'phone' => '081234567890',
            'company' => 'Coating Solutions Co.',
            'position' => 'Procurement Manager',
            'taxId' => '01.234.567.8-901.000',
        ], $overrides);
    }

    public function test_full_flow_register_verify_login_and_admin_approval(): void
    {
        Mail::fake();

        $this->fromFrontend()->withHeader('Accept-Language', 'en')
            ->postJson('/api/v1/auth/register', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.email', 'buyer@coatingsolutions.co.id')
            ->assertJsonPath('data.status', User::STATUS_PENDING)
            ->assertJsonPath('data.emailVerifiedAt', null)
            ->assertJsonStructure(['data' => ['id'], 'message']);

        $this->assertGuest('web');

        $user = User::where('email', 'buyer@coatingsolutions.co.id')->firstOrFail();
        $this->assertSame(User::ROLE_CUSTOMER, $user->role);
        $this->assertSame(User::STATUS_PENDING, $user->status);
        $this->assertSame('en', $user->locale);
        $this->assertNull($user->email_verified_at);
        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $user->id,
            'company' => 'Coating Solutions Co.',
            'position' => 'Procurement Manager',
            'tax_id' => '01.234.567.8-901.000',
            'phone' => '081234567890',
        ]);

        $verifyUrl = null;
        Mail::assertQueued(VerifyEmail::class, function (VerifyEmail $mail) use ($user, &$verifyUrl) {
            $verifyUrl = $mail->url;

            return $mail->hasTo('buyer@coatingsolutions.co.id') && $mail->user->is($user) && $mail->locale === 'en';
        });
        $this->assertNotNull($verifyUrl);
        $this->assertStringContainsString('/api/v1/auth/verify-email/'.$user->id.'/', $verifyUrl);
        $this->assertStringContainsString('signature=', $verifyUrl);

        // Login sebelum verifikasi → 403 EMAIL_NOT_VERIFIED.
        $this->fromFrontend()->postJson('/api/v1/auth/login', ['email' => 'buyer@coatingsolutions.co.id', 'password' => 'Rahasia123'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'EMAIL_NOT_VERIFIED');

        // Verifikasi lewat URL bertanda tangan → redirect ke FE.
        $this->get($verifyUrl)->assertRedirect(config('ikn.frontend_url').'/login?verified=1');
        $this->assertNotNull($user->fresh()->email_verified_at);

        // Tautan yang sama dipakai lagi tetap idempoten.
        $this->get($verifyUrl)->assertRedirect(config('ikn.frontend_url').'/login?verified=1');

        // Login OK walau masih pending (ASUMSI A-12), profil ikut di respons.
        $login = $this->fromFrontend()->postJson('/api/v1/auth/login', ['email' => 'buyer@coatingsolutions.co.id', 'password' => 'Rahasia123'])
            ->assertOk()
            ->assertJsonPath('data.user.status', User::STATUS_PENDING)
            ->assertJsonPath('data.user.role', User::ROLE_CUSTOMER)
            ->assertJsonPath('data.user.locale', 'en')
            ->assertJsonPath('data.user.profile.company', 'Coating Solutions Co.')
            ->assertJsonPath('data.user.profile.taxId', '01.234.567.8-901.000');
        $this->assertArrayNotHasKey('permissions', $login->json('data.user'));

        // Endpoint ber-middleware customer.active → 403 ACCOUNT_NOT_APPROVED.
        $this->app['auth']->forgetGuards();
        $this->actingAs($user->fresh())->getJson('/api/v1/_test/customer-active')
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNT_NOT_APPROVED')
            ->assertJsonPath('meta.status', User::STATUS_PENDING);

        // Admin dengan modul customers menyetujui.
        $admin = $this->adminWith(['customers']);
        $this->app['auth']->forgetGuards();
        $this->fromFrontend()->actingAs($admin)
            ->putJson('/api/v1/admin/customers/'.$user->id.'/status', ['status' => User::STATUS_ACTIVE])
            ->assertOk()
            ->assertJsonPath('data.status', User::STATUS_ACTIVE)
            ->assertJsonPath('data.approvedBy.id', $admin->id);

        Mail::assertQueued(AccountApproved::class, fn (AccountApproved $mail) => $mail->hasTo('buyer@coatingsolutions.co.id'));

        $approved = $user->fresh();
        $this->assertSame(User::STATUS_ACTIVE, $approved->status);
        $this->assertNotNull($approved->approved_at);
        $this->assertSame($admin->id, $approved->approved_by);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'subject_type' => 'User',
            'subject_id' => $user->id,
            'action' => 'PUT api/v1/admin/customers/{customer}/status',
        ]);

        // Setelah disetujui, endpoint customer.active lolos.
        $this->app['auth']->forgetGuards();
        $this->actingAs($approved)->getJson('/api/v1/_test/customer-active')->assertOk()->assertJsonPath('data.ok', true);
    }

    public function test_invalid_or_expired_verification_link_redirects_with_verified_0(): void
    {
        $user = User::factory()->unverified()->create();

        // Tanpa tanda tangan.
        $this->get('/api/v1/auth/verify-email/'.$user->id.'/'.sha1($user->email))
            ->assertRedirect(config('ikn.frontend_url').'/login?verified=0');

        // Tanda tangan valid tetapi user tidak ada.
        $url = URL::temporarySignedRoute('auth.verify-email', now()->addMinutes(5), ['id' => 999999, 'hash' => sha1('x')]);
        $this->get($url)->assertRedirect(config('ikn.frontend_url').'/login?verified=0');

        // Kedaluwarsa.
        $expired = URL::temporarySignedRoute('auth.verify-email', now()->subMinute(), ['id' => $user->id, 'hash' => sha1($user->email)]);
        $this->get($expired)->assertRedirect(config('ikn.frontend_url').'/login?verified=0');

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_register_validates_password_policy_confirmation_and_unique_email(): void
    {
        Mail::fake();
        $this->customer(['email' => 'ada@example.com']);

        $this->fromFrontend()->postJson('/api/v1/auth/register', $this->payload(['password' => 'abcdefgh', 'passwordConfirmation' => 'abcdefgh']))
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR')
            ->assertJsonValidationErrors(['password']);

        $this->fromFrontend()->postJson('/api/v1/auth/register', $this->payload(['passwordConfirmation' => 'Berbeda123']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password']);

        $this->fromFrontend()->postJson('/api/v1/auth/register', $this->payload(['email' => 'ADA@Example.com']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        Mail::assertNothingQueued();
        $this->assertSame(1, User::count());
    }

    public function test_register_is_rate_limited_to_three_per_minute(): void
    {
        Mail::fake();

        for ($i = 1; $i <= 3; $i++) {
            $this->fromFrontend()->postJson('/api/v1/auth/register', $this->payload(['email' => "user{$i}@example.com"]))
                ->assertCreated();
        }

        $this->fromFrontend()->postJson('/api/v1/auth/register', $this->payload(['email' => 'user4@example.com']))
            ->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS');
    }

    public function test_resend_verification_always_returns_200_and_only_sends_to_unverified(): void
    {
        Mail::fake();
        $unverified = User::factory()->unverified()->create(['email' => 'belum@example.com']);
        $this->customer(['email' => 'sudah@example.com']);

        $this->postJson('/api/v1/auth/verification/resend', ['email' => 'tidak-ada@example.com'])->assertOk();
        Mail::assertNothingQueued();

        $this->postJson('/api/v1/auth/verification/resend', ['email' => 'sudah@example.com'])->assertOk();
        Mail::assertNothingQueued();

        $this->postJson('/api/v1/auth/verification/resend', ['email' => 'BELUM@example.com'])
            ->assertOk()
            ->assertJsonPath('data.ok', true);
        Mail::assertQueued(VerifyEmail::class, fn (VerifyEmail $mail) => $mail->user->is($unverified));
    }

    public function test_rejected_and_inactive_customers_cannot_login(): void
    {
        $this->customer(['email' => 'tolak@example.com', 'status' => User::STATUS_REJECTED]);
        $this->customer(['email' => 'off@example.com', 'status' => User::STATUS_INACTIVE]);

        $this->fromFrontend()->postJson('/api/v1/auth/login', ['email' => 'tolak@example.com', 'password' => 'password'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNT_NOT_APPROVED')
            ->assertJsonPath('meta.status', User::STATUS_REJECTED);

        $this->fromFrontend()->postJson('/api/v1/auth/login', ['email' => 'off@example.com', 'password' => 'password'])
            ->assertStatus(403)
            ->assertJsonPath('meta.status', User::STATUS_INACTIVE);
    }

    public function test_me_returns_profile_for_customer_and_modules_for_admin(): void
    {
        $customer = $this->customer();
        $customer->profile()->create(['company' => 'PT Uji', 'phone' => '0811']);

        $this->actingAs($customer)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.profile.company', 'PT Uji')
            ->assertJsonPath('data.user.profile.phone', '0811')
            ->assertJsonPath('data.user.locale', 'id')
            ->assertJsonPath('data.user.rejectionReason', null);

        $this->app['auth']->forgetGuards();
        $admin = $this->adminWith(['customers', 'orders']);
        $me = $this->actingAs($admin)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.modules', ['customers', 'orders'])
            ->assertJsonPath('data.user.permissions', ['customers', 'orders']);
        $this->assertArrayNotHasKey('profile', $me->json('data.user'));
    }
}
