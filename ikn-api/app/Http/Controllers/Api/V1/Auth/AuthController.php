<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

// Sanctum mode cookie SPA (arsitektur 3.1): sesi web, bukan bearer token.
class AuthController extends ApiController
{
    // Login customer. Registrasi + verifikasi email menyusul di phase akun.
    public function login(LoginRequest $request)
    {
        $user = $this->attempt($request, User::ROLE_CUSTOMER);

        if (! $user->email_verified_at) {
            throw new ApiException(403, 'EMAIL_NOT_VERIFIED', __('api.email_not_verified'));
        }

        if (in_array($user->status, [User::STATUS_REJECTED, User::STATUS_INACTIVE], true)) {
            throw new ApiException(403, 'ACCOUNT_NOT_APPROVED', __('api.account_inactive'), ['status' => $user->status]);
        }

        return $this->establishSession($request, $user);
    }

    public function adminLogin(LoginRequest $request)
    {
        $user = $this->attempt($request, User::ROLE_ADMIN, User::ROLE_SUPER_ADMIN);

        if (! $user->isActive()) {
            throw new ApiException(403, 'FORBIDDEN', __('api.account_inactive'));
        }

        return $this->establishSession($request, $user);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return $this->data(['ok' => true], 200, ['message' => __('api.logged_out')]);
    }

    public function me(Request $request)
    {
        return $this->data(['user' => new UserResource($request->user())]);
    }

    private function attempt(LoginRequest $request, string ...$roles): User
    {
        $user = User::where('email', strtolower(trim($request->input('email'))))->first();

        if (! $user || ! in_array($user->role, $roles, true) || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['email' => [__('api.login_failed')]]);
        }

        return $user;
    }

    private function establishSession(Request $request, User $user)
    {
        if (! $request->hasSession()) {
            // Klien harus mengirim Origin/Referer dari domain FE (SANCTUM_STATEFUL_DOMAINS).
            throw new ApiException(400, 'BAD_REQUEST', 'Stateful session required: send requests from an allowed frontend origin.');
        }

        Auth::guard('web')->login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        $user->forceFill(['last_login_at' => now()])->save();

        return $this->data(['user' => new UserResource($user)]);
    }
}
