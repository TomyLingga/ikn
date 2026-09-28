<?php

namespace App\Providers;

use Illuminate\Support\Carbon;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        // Kalkulator ongkir default (KEPUTUSAN ongkir): ganti implementasi di sini bila beralih ke RajaOngkir/Biteship.
        $this->app->bind(
            \App\Services\Commerce\Shipping\ShippingRateCalculator::class,
            \App\Services\Commerce\Shipping\ZoneRateCalculator::class
        );
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        // Waktu di API selalu ISO-8601 dengan offset zona aplikasi (Asia/Jakarta), apa pun zona koneksi DB (UTC).
        Carbon::macro('toApiString', function () {
            /** @var Carbon $this */
            return $this->copy()->setTimezone(config('app.timezone'))->toIso8601String();
        });
    }
}
