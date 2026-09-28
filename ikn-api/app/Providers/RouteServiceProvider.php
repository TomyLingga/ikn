<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    public const HOME = '/';

    public function boot()
    {
        $this->configureRateLimiting();

        $this->routes(function () {
            Route::prefix('api/v1')
                ->middleware('api')
                ->namespace($this->namespace)
                ->group(base_path('routes/api.php'));

            // Route per modul commerce (routes/api/*.php): customer, catalog, commerce, admin-commerce.
            // Dipisah per file agar tiap modul bisa dikerjakan tanpa konflik di satu berkas.
            foreach (glob(base_path('routes/api/*.php')) ?: [] as $file) {
                Route::prefix('api/v1')
                    ->middleware('api')
                    ->namespace($this->namespace)
                    ->group($file);
            }

            Route::middleware('web')
                ->namespace($this->namespace)
                ->group(base_path('routes/web.php'));
        });
    }

    protected function configureRateLimiting()
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by(optional($request->user())->id ?: $request->ip());
        });

        // Login: 5 percobaan per menit per IP+email (ASUMSI A-25).
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip().'|'.strtolower((string) $request->input('email')));
        });

        // Formulir publik (WBS, kontak): 5 per jam per IP.
        RateLimiter::for('public-form', function (Request $request) {
            return Limit::perHour(5)->by($request->ip());
        });

        // Registrasi customer: 3 per menit per IP (ASUMSI A-25).
        RateLimiter::for('register', function (Request $request) {
            return Limit::perMinute(3)->by($request->ip());
        });

        // Kirim ulang verifikasi email: 3 per jam per email+IP.
        RateLimiter::for('verification-resend', function (Request $request) {
            return Limit::perHour(3)->by($request->ip().'|'.strtolower((string) $request->input('email')));
        });

        // Proxy geocoding: 60 per menit per IP (upstream Nominatim dibatasi 1/detik di NominatimClient).
        RateLimiter::for('geo', function (Request $request) {
            return Limit::perMinute(60)->by($request->ip());
        });
    }
}
