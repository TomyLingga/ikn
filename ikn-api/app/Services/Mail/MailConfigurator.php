<?php

namespace App\Services\Mail;

use App\Services\Cms\SettingsService;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Menerapkan pengaturan email dari tabel settings (grup "mail", diatur admin di Pengaturan Situs) ke config
 * mail saat runtime (ASUMSI A-82). Dipanggil saat `mail.manager` pertama kali dibangun (HTTP, artisan) dan
 * sebelum setiap job antrean (worker berumur panjang) lewat AppServiceProvider.
 *
 * mode: server = biarkan MAIL_* dari .env; smtp = timpa mailer smtp + alamat pengirim; off = mailer "array"
 * (email tidak dikirim, notifikasi dalam aplikasi tetap jalan). DB belum siap (migrasi awal) → server.
 */
class MailConfigurator
{
    public const MODE_SERVER = 'server';
    public const MODE_SMTP = 'smtp';
    public const MODE_OFF = 'off';

    public const KEYS = ['mode', 'host', 'port', 'encryption', 'username', 'password', 'from_address', 'from_name'];

    /** Snapshot config .env sebelum ditimpa, untuk kembali ke mode server dalam proses yang sama (worker). */
    private ?array $original = null;

    public function __construct(private Application $app, private SettingsService $settings)
    {
    }

    /** Pengaturan tersimpan (password sudah didekripsi). */
    public function current(): array
    {
        $out = [];
        foreach (self::KEYS as $key) {
            $out[$key] = $key === 'password' ? $this->settings->secret('mail.password') : $this->settings->get('mail.'.$key);
        }
        $out['mode'] = in_array($out['mode'], SettingsService::MAIL_MODES, true) ? $out['mode'] : self::MODE_SERVER;
        $out['port'] = (int) ($out['port'] ?: 465);

        return $out;
    }

    /**
     * Terapkan ke config mail. $override (bentuk sama dengan PUT /admin/site-settings `mail`, password boleh mask)
     * dipakai tombol "Kirim email uji" sebelum pengaturan disimpan. Mengembalikan mode efektif.
     */
    public function apply(?array $override = null): string
    {
        $this->original ??= [
            'default' => config('mail.default'),
            'smtp' => (array) config('mail.mailers.smtp'),
            'from' => (array) config('mail.from'),
        ];

        try {
            $mail = $this->current();
        } catch (Throwable $e) {
            Log::debug('mail settings unavailable, using .env: '.$e->getMessage());

            return self::MODE_SERVER;
        }

        if ($override) {
            foreach (self::KEYS as $key) {
                if (! array_key_exists($key, $override) || $override[$key] === null) {
                    continue;
                }
                if ($key === 'password' && $override[$key] === SettingsService::SECRET_MASK) {
                    continue;
                }
                $mail[$key] = $key === 'port' ? (int) $override[$key] : (string) $override[$key];
            }
            $mail['mode'] = in_array($mail['mode'], SettingsService::MAIL_MODES, true) ? $mail['mode'] : self::MODE_SERVER;
        }

        // Kembalikan dulu nilai .env agar mode server/off tidak mewarisi SMTP yang pernah diterapkan.
        config([
            'mail.default' => $this->original['default'],
            'mail.mailers.smtp' => $this->original['smtp'],
            'mail.from' => $this->original['from'],
        ]);

        if ($mail['mode'] === self::MODE_OFF) {
            config(['mail.default' => 'array']);
        } elseif ($mail['mode'] === self::MODE_SMTP) {
            config([
                'mail.default' => 'smtp',
                'mail.mailers.smtp' => [
                    'transport' => 'smtp',
                    'host' => (string) $mail['host'],
                    'port' => $mail['port'],
                    'encryption' => $mail['encryption'] !== '' ? $mail['encryption'] : null,
                    'username' => $mail['username'] !== '' ? $mail['username'] : null,
                    'password' => $mail['username'] !== '' ? (string) $mail['password'] : null,
                    'timeout' => 20,
                    'auth_mode' => null,
                ],
                'mail.from' => [
                    'address' => $mail['from_address'] !== '' ? $mail['from_address'] : ($this->original['from']['address'] ?? null),
                    'name' => $mail['from_name'] !== '' ? $mail['from_name'] : ($this->original['from']['name'] ?? null),
                ],
            ]);
        }

        return $mail['mode'];
    }

    /** apply() + buang mailer yang sudah dibangun agar transport berikutnya memakai config baru. */
    public function refresh(?array $override = null): string
    {
        $mode = $this->apply($override);
        if ($this->app->resolved('mail.manager')) {
            $this->app->make('mail.manager')->forgetMailers();
        }

        return $mode;
    }

    /** Ringkasan untuk respons/log: tanpa password. */
    public function describe(string $mode): array
    {
        $mail = $this->original ?? [];

        return [
            'mode' => $mode,
            'mailer' => (string) config('mail.default'),
            'host' => $mode === self::MODE_SMTP ? (string) config('mail.mailers.smtp.host') : (string) ($mail['smtp']['host'] ?? config('mail.mailers.smtp.host')),
            'from' => (string) config('mail.from.address'),
        ];
    }
}
