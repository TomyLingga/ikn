<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

// Lupa/reset kata sandi lewat Password broker (tabel password_resets). Tautan reset menuju FE.
class PasswordController extends ApiController
{
    // Selalu 200 agar tidak membocorkan keberadaan email (termasuk saat broker throttle 60 detik).
    public function forgot(ForgotPasswordRequest $request)
    {
        Password::broker()->sendResetLink(['email' => $request->input('email')]);

        return $this->data(['ok' => true], 200, ['message' => __('account.password_reset_link_sent')]);
    }

    public function reset(ResetPasswordRequest $request)
    {
        $status = Password::broker()->reset(
            [
                'email' => $request->input('email'),
                'password' => $request->input('password'),
                'password_confirmation' => $request->input('passwordConfirmation'),
                'token' => $request->input('token'),
            ],
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['token' => [__('account.reset_token_invalid')]]);
        }

        return $this->data(['ok' => true], 200, ['message' => __('account.password_reset_done')]);
    }
}
