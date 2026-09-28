<?php

namespace Tests\Feature\Account;

use App\Mail\Account\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_and_reset_password_end_to_end(): void
    {
        Mail::fake();
        $user = $this->customer(['email' => 'buyer@example.com', 'locale' => 'id']);

        // Email tidak dikenal: tetap 200, tidak ada email.
        $this->postJson('/api/v1/auth/password/forgot', ['email' => 'tidak-ada@example.com'])
            ->assertOk()
            ->assertJsonPath('data.ok', true);
        Mail::assertNothingQueued();

        $this->postJson('/api/v1/auth/password/forgot', ['email' => 'BUYER@example.com'])->assertOk();

        $token = null;
        Mail::assertQueued(ResetPassword::class, function (ResetPassword $mail) use ($user, &$token) {
            $token = $mail->token;

            return $mail->hasTo('buyer@example.com')
                && $mail->user->is($user)
                && str_starts_with($mail->url, config('ikn.frontend_url').'/reset-password?')
                && str_contains($mail->url, 'token='.$token)
                && str_contains($mail->url, 'email=buyer%40example.com');
        });
        $this->assertNotNull($token);
        $this->assertDatabaseHas('password_resets', ['email' => 'buyer@example.com']);

        // Kebijakan password juga berlaku saat reset.
        $this->postJson('/api/v1/auth/password/reset', [
            'token' => $token, 'email' => 'buyer@example.com', 'password' => 'hurufsaja', 'passwordConfirmation' => 'hurufsaja',
        ])->assertStatus(422)->assertJsonValidationErrors(['password']);

        $this->postJson('/api/v1/auth/password/reset', [
            'token' => $token, 'email' => 'buyer@example.com', 'password' => 'BaruAman123', 'passwordConfirmation' => 'BaruAman123',
        ])->assertOk()->assertJsonPath('data.ok', true)->assertJsonStructure(['message']);

        $this->assertTrue(Hash::check('BaruAman123', $user->fresh()->password));
        $this->assertDatabaseMissing('password_resets', ['email' => 'buyer@example.com']);

        // Token sekali pakai.
        $this->postJson('/api/v1/auth/password/reset', [
            'token' => $token, 'email' => 'buyer@example.com', 'password' => 'LagiAman123', 'passwordConfirmation' => 'LagiAman123',
        ])->assertStatus(422)->assertJsonValidationErrors(['token']);

        // Login dengan password baru.
        $this->fromFrontend()->postJson('/api/v1/auth/login', ['email' => 'buyer@example.com', 'password' => 'BaruAman123'])
            ->assertOk()
            ->assertJsonPath('data.user.id', $user->id);
    }

    public function test_reset_with_invalid_token_is_rejected(): void
    {
        $this->customer(['email' => 'buyer@example.com']);

        $this->postJson('/api/v1/auth/password/reset', [
            'token' => 'token-palsu', 'email' => 'buyer@example.com', 'password' => 'BaruAman123', 'passwordConfirmation' => 'BaruAman123',
        ])->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR')
            ->assertJsonValidationErrors(['token']);
    }
}
