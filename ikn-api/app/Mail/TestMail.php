<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Carbon;

// Email uji dari tombol "Kirim email uji" di Pengaturan Situs. Sengaja tidak ShouldQueue agar kegagalan
// transport langsung terlihat di respons API.
class TestMail extends Mailable
{
    public function __construct(public ?User $sender, public string $via)
    {
    }

    public function build(): self
    {
        return $this->subject(__('account.mail.test.subject'))
            ->view('mail.test', [
                'sender' => $this->sender?->name ?: 'Admin',
                'time' => Carbon::now()->setTimezone(config('app.timezone'))->format('d-m-Y H:i'),
                'via' => $this->via,
            ]);
    }
}
