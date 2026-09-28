<?php

namespace App\Services\Account;

use App\Mail\Account\VerifyEmail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

// Registrasi customer: user pending + profil, lalu email verifikasi (URL bertanda tangan 60 menit, ASUMSI A-25).
class RegistrationService
{
    public const VERIFY_TTL_MINUTES = 60;

    /** @param  array{name:string,email:string,password:string,phone?:?string,company?:?string,position?:?string,taxId?:?string}  $data */
    public function register(array $data, string $locale): User
    {
        $user = DB::transaction(function () use ($data, $locale) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'role' => User::ROLE_CUSTOMER,
                'status' => User::STATUS_PENDING,
                'locale' => in_array($locale, User::LOCALES, true) ? $locale : 'id',
                'email_verified_at' => null,
            ]);

            $user->profile()->create([
                'company' => $data['company'] ?? null,
                'position' => $data['position'] ?? null,
                'tax_id' => $data['taxId'] ?? null,
                'phone' => $data['phone'] ?? null,
            ]);

            return $user;
        });

        $this->sendVerification($user);

        return $user;
    }

    public function sendVerification(User $user): void
    {
        $url = URL::temporarySignedRoute(
            'auth.verify-email',
            now()->addMinutes(self::VERIFY_TTL_MINUTES),
            ['id' => $user->id, 'hash' => $this->hashFor($user)]
        );

        Mail::to($user)->send(new VerifyEmail($user, $url, self::VERIFY_TTL_MINUTES));
    }

    // Hash email di URL: tautan lama tidak berlaku bila email user berubah.
    public function hashFor(User $user): string
    {
        return sha1($user->email);
    }

    /** Tandai terverifikasi bila hash cocok; true juga bila sudah terverifikasi sebelumnya (idempoten). */
    public function verify(User $user, string $hash): bool
    {
        if (! hash_equals($this->hashFor($user), $hash)) {
            return false;
        }

        if (! $user->hasVerifiedEmail()) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return true;
    }

    // Selalu diam bila email tidak ada / sudah terverifikasi (tidak membocorkan keberadaan akun).
    public function resend(string $email): void
    {
        $user = User::customers()->where('email', strtolower(trim($email)))->first();

        if ($user && ! $user->hasVerifiedEmail()) {
            $this->sendVerification($user);
        }
    }
}
