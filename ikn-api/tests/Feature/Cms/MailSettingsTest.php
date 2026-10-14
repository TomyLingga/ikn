<?php

namespace Tests\Feature\Cms;

use App\Mail\TestMail;
use App\Models\Setting;
use App\Services\Cms\SettingsService;
use App\Services\Mail\MailConfigurator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

// Pengaturan email notifikasi dari admin (ASUMSI A-82): grup mail privat, password terenkripsi + dimask,
// mode server/smtp/off diterapkan ke config mail saat runtime, tombol email uji.
class MailSettingsTest extends TestCase
{
    use RefreshDatabase;

    private const SMTP = [
        'mode' => 'smtp',
        'host' => 'smtp.hostinger.com',
        'port' => 465,
        'encryption' => 'ssl',
        'username' => 'noreply@ptikn.com',
        'password' => 'rahasia-webmail',
        'from_address' => 'NoReply@ptikn.com',
        'from_name' => 'PT IKN Online',
    ];

    public function test_mail_settings_are_private_masked_and_encrypted(): void
    {
        $admin = $this->adminWith(['settings']);

        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['mail' => self::SMTP])
            ->assertOk()
            ->assertJsonPath('data.mail.mode', 'smtp')
            ->assertJsonPath('data.mail.host', 'smtp.hostinger.com')
            ->assertJsonPath('data.mail.port', 465)
            ->assertJsonPath('data.mail.from_address', 'noreply@ptikn.com')
            ->assertJsonPath('data.mail.password', SettingsService::SECRET_MASK);

        // Publik tidak pernah melihat grup mail; di DB password tidak tersimpan apa adanya.
        $this->assertArrayNotHasKey('mail', $this->getJson('/api/v1/content/settings')->json('data'));
        $stored = Setting::find('mail.password')->value;
        $this->assertNotSame('rahasia-webmail', $stored);
        $this->assertSame('rahasia-webmail', Crypt::decryptString($stored));
        $this->assertSame('rahasia-webmail', app(SettingsService::class)->secret('mail.password'));

        // Mask dikirim balik = password tetap; string kosong = dihapus.
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['mail' => ['password' => SettingsService::SECRET_MASK, 'from_name' => 'IKN']])
            ->assertOk()->assertJsonPath('data.mail.password', SettingsService::SECRET_MASK)->assertJsonPath('data.mail.from_name', 'IKN');
        $this->assertSame('rahasia-webmail', app(SettingsService::class)->secret('mail.password'));
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['mail' => ['password' => '']])
            ->assertOk()->assertJsonPath('data.mail.password', '');
        $this->assertSame('', app(SettingsService::class)->secret('mail.password'));
    }

    public function test_mail_settings_are_validated_atomically(): void
    {
        $admin = $this->adminWith(['settings']);

        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['mail' => [
            'mode' => 'smtp', 'host' => 'mail.ptikn.com', 'port' => 70000, 'encryption' => 'starttls', 'from_address' => 'bukan-email',
        ]])->assertStatus(422)->assertJsonValidationErrors(['mail.port', 'mail.encryption', 'mail.from_address']);
        // Tidak ada yang ditulis bila sebagian tidak valid.
        $this->assertDatabaseMissing('settings', ['key' => 'mail.host']);

        // Mode smtp tanpa host / pengirim → 422; mode server boleh kosong.
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['mail' => ['mode' => 'smtp']])
            ->assertStatus(422)->assertJsonValidationErrors(['mail.host', 'mail.from_address']);
        $this->actingAs($admin)->putJson('/api/v1/admin/site-settings', ['mail' => ['mode' => 'server', 'host' => '']])
            ->assertOk()->assertJsonPath('data.mail.mode', 'server');
        $this->actingAs($this->adminWith(['cms']))->putJson('/api/v1/admin/site-settings', ['mail' => self::SMTP])->assertStatus(403);
    }

    public function test_configurator_applies_modes_to_runtime_mail_config(): void
    {
        $configurator = app(MailConfigurator::class);
        $originalMailer = config('mail.default');

        $this->assertSame('server', $configurator->apply());
        $this->assertSame($originalMailer, config('mail.default'));

        app(SettingsService::class)->update(['mail' => self::SMTP]);
        $this->assertSame('smtp', $configurator->refresh());
        $this->assertSame('smtp', config('mail.default'));
        $this->assertSame('smtp.hostinger.com', config('mail.mailers.smtp.host'));
        $this->assertSame(465, config('mail.mailers.smtp.port'));
        $this->assertSame('ssl', config('mail.mailers.smtp.encryption'));
        $this->assertSame('rahasia-webmail', config('mail.mailers.smtp.password'));
        $this->assertSame('noreply@ptikn.com', config('mail.from.address'));
        $this->assertSame('PT IKN Online', config('mail.from.name'));

        // Override dari form (password mask = tersimpan) tanpa menyentuh DB.
        $this->assertSame('smtp', $configurator->apply(['host' => 'mail.lain.com', 'password' => SettingsService::SECRET_MASK, 'encryption' => '']));
        $this->assertSame('mail.lain.com', config('mail.mailers.smtp.host'));
        $this->assertNull(config('mail.mailers.smtp.encryption'));
        $this->assertSame('rahasia-webmail', config('mail.mailers.smtp.password'));

        app(SettingsService::class)->update(['mail' => ['mode' => 'off']]);
        $this->assertSame('off', $configurator->refresh());
        $this->assertSame('array', config('mail.default'));

        // Kembali ke server: config .env dipulihkan dalam proses yang sama (worker).
        app(SettingsService::class)->update(['mail' => ['mode' => 'server']]);
        $this->assertSame('server', $configurator->refresh());
        $this->assertSame($originalMailer, config('mail.default'));
        $this->assertNotSame('smtp.hostinger.com', config('mail.mailers.smtp.host'));
    }

    public function test_admin_sends_test_mail_with_form_values(): void
    {
        Mail::fake();
        $admin = $this->adminWith(['settings'], ['name' => 'Admin Konten']);

        $this->actingAs($admin)->postJson('/api/v1/admin/site-settings/mail-test', ['to' => 'bukan-email'])
            ->assertStatus(422)->assertJsonValidationErrors(['to']);
        $this->actingAs($admin)->postJson('/api/v1/admin/site-settings/mail-test', ['to' => 'it@ptikn.com', 'mail' => ['mode' => 'smtp', 'host' => '']])
            ->assertStatus(422)->assertJsonValidationErrors(['mail.host', 'mail.from_address']);

        $this->actingAs($admin)->postJson('/api/v1/admin/site-settings/mail-test', ['to' => 'IT@ptikn.com', 'mail' => self::SMTP])
            ->assertOk()
            ->assertJsonPath('data.mode', 'smtp')
            ->assertJsonPath('data.host', 'smtp.hostinger.com')
            ->assertJsonPath('data.to', 'it@ptikn.com');
        Mail::assertSent(TestMail::class, fn (TestMail $mail) => $mail->hasTo('it@ptikn.com') && str_contains($mail->via, 'smtp.hostinger.com'));
        // Email uji tidak menyimpan apa pun.
        $this->assertDatabaseMissing('settings', ['key' => 'mail.host']);

        // Mode off → 422 MAIL_DISABLED.
        $this->actingAs($admin)->postJson('/api/v1/admin/site-settings/mail-test', ['to' => 'it@ptikn.com', 'mail' => ['mode' => 'off']])
            ->assertStatus(422)->assertJsonPath('code', 'MAIL_DISABLED');
    }

    public function test_test_mail_renders_in_both_locales(): void
    {
        $admin = $this->adminWith(['settings'], ['name' => 'Admin Konten']);
        $html = (new TestMail($admin, 'SMTP smtp.hostinger.com'))->render();
        $this->assertStringContainsString('Admin Konten', $html);
        $this->assertStringContainsString('smtp.hostinger.com', $html);
        $this->assertStringContainsString('PT Industri Karet Nusantara', $html);
        $this->assertStringContainsString('Jika Anda membaca email ini', $html);
        $this->assertStringContainsString('If you are reading this', (new TestMail($admin, 'x'))->locale('en')->render());
    }
}
