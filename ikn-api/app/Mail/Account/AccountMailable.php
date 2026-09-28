<?php

namespace App\Mail\Account;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

// Dasar email akun: antrean (queue), bahasa mengikuti users.locale, tautan ke FE dari config ikn.frontend_url.
abstract class AccountMailable extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public User $user;

    public function __construct(User $user)
    {
        $this->user = $user;
        $this->locale = $user->preferredLocale();
    }

    protected function frontendUrl(string $path = ''): string
    {
        return rtrim((string) config('ikn.frontend_url'), '/').'/'.ltrim($path, '/');
    }

    protected function trans(string $key, array $replace = []): string
    {
        return __($key, $replace, $this->locale);
    }
}
