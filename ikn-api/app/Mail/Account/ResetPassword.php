<?php

namespace App\Mail\Account;

use App\Models\User;

// Tautan reset kata sandi ke FE: /reset-password?token=...&email=... (token dari Password broker, berlaku auth.passwords.users.expire menit).
class ResetPassword extends AccountMailable
{
    public string $token;

    public string $url;

    public int $minutes;

    public function __construct(User $user, string $token)
    {
        parent::__construct($user);
        $this->token = $token;
        $this->minutes = (int) config('auth.passwords.users.expire', 60);
        $this->url = $this->frontendUrl('/reset-password').'?'.http_build_query([
            'token' => $token,
            'email' => $user->email,
        ]);
    }

    public function build(): self
    {
        return $this->subject($this->trans('account.mail.reset.subject'))
            ->view('mail.account.reset-password', [
                'user' => $this->user,
                'url' => $this->url,
                'minutes' => $this->minutes,
            ]);
    }
}
