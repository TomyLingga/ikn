<?php

namespace App\Providers;

use App\Services\Mail\MailConfigurator;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;
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

        // Pengaturan email dari tabel settings (grup mail, Pengaturan Situs) menimpa config mail tepat sebelum
        // mailer pertama dibangun (ASUMSI A-82). Mailer dibangun malas, jadi request tanpa email tidak membayar query.
        $this->app->singleton(MailConfigurator::class); // satu snapshot config .env per proses
        $this->app->resolving('mail.manager', function () {
            $this->app->make(MailConfigurator::class)->apply();
        });
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

        // Worker antrean berumur panjang: terapkan ulang pengaturan email sebelum tiap job agar perubahan admin
        // berlaku tanpa restart worker (mailer yang sudah dibangun dibuang).
        Queue::before(function (JobProcessing $event) {
            $this->app->make(MailConfigurator::class)->refresh();
        });
    }
}
