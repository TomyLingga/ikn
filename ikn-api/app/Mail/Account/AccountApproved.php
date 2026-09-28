<?php

namespace App\Mail\Account;

use App\Models\User;

// Dikirim saat admin menyetujui customer (pending → active).
class AccountApproved extends AccountMailable
{
    public string $url;

    public function __construct(User $user)
    {
        parent::__construct($user);
        $this->url = $this->frontendUrl('/login');
    }

    public function build(): self
    {
        $company = $this->user->profile?->company ?: $this->user->name;

        return $this->subject($this->trans('account.mail.approved.subject'))
            ->view('mail.account.account-approved', [
                'user' => $this->user,
                'company' => $company,
                'url' => $this->url,
            ]);
    }
}
