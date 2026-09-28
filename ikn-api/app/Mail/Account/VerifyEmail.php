<?php

namespace App\Mail\Account;

use App\Models\User;

// Tautan verifikasi email (URL bertanda tangan sementara, 60 menit; ASUMSI A-25).
class VerifyEmail extends AccountMailable
{
    public string $url;

    public int $minutes;

    public function __construct(User $user, string $url, int $minutes = 60)
    {
        parent::__construct($user);
        $this->url = $url;
        $this->minutes = $minutes;
    }

    public function build(): self
    {
        return $this->subject($this->trans('account.mail.verify.subject'))
            ->view('mail.account.verify-email', [
                'user' => $this->user,
                'url' => $this->url,
                'minutes' => $this->minutes,
            ]);
    }
}
