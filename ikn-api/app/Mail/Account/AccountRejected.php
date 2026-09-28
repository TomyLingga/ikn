<?php

namespace App\Mail\Account;

use App\Models\User;

// Dikirim saat admin menolak customer (status rejected) beserta alasan.
class AccountRejected extends AccountMailable
{
    public ?string $reason;

    public string $url;

    public function __construct(User $user, ?string $reason = null)
    {
        parent::__construct($user);
        $this->reason = $reason ?? $user->rejection_reason;
        $this->url = $this->frontendUrl('/kontak');
    }

    public function build(): self
    {
        return $this->subject($this->trans('account.mail.rejected.subject'))
            ->view('mail.account.account-rejected', [
                'user' => $this->user,
                'reason' => $this->reason,
                'url' => $this->url,
            ]);
    }
}
