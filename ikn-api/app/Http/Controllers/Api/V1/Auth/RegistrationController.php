<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResendVerificationRequest;
use App\Models\User;
use App\Services\Account\RegistrationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

// Registrasi customer + verifikasi email (kontrak bagian 3). Tidak login otomatis setelah daftar.
class RegistrationController extends ApiController
{
    public function __construct(private RegistrationService $registration)
    {
    }

    public function register(RegisterRequest $request)
    {
        $user = $this->registration->register($request->validated(), app()->getLocale());

        return $this->created([
            'id' => $user->id,
            'email' => $user->email,
            'status' => $user->status,
            'emailVerifiedAt' => optional($user->email_verified_at)->toApiString(),
        ], ['message' => __('account.registered')]);
    }

    // Tautan dari email (URL bertanda tangan, middleware signed). Selalu redirect ke FE.
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::find($id);
        $ok = $user !== null && $this->registration->verify($user, $hash);

        return redirect()->away(self::loginRedirect($ok));
    }

    public function resend(ResendVerificationRequest $request)
    {
        $this->registration->resend($request->input('email'));

        return $this->data(['ok' => true], 200, ['message' => __('account.verification_resent')]);
    }

    public static function loginRedirect(bool $verified): string
    {
        return rtrim((string) config('ikn.frontend_url'), '/').'/login?verified='.($verified ? '1' : '0');
    }
}
