<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        // Order & pembayaran (BE-3): expiry tiap menit, pengingat tiap 15 menit, auto-complete harian.
        $schedule->command('orders:expire')->everyMinute()->withoutOverlapping();
        $schedule->command('orders:remind')->everyFifteenMinutes()->withoutOverlapping();
        $schedule->command('orders:auto-complete')->dailyAt('01:00')->withoutOverlapping();
        // Penawaran ongkir CIF (ASUMSI A-89): kedaluwarsa penawaran + batas tunggu order awaiting_freight, tiap 15 menit.
        $schedule->command('orders:freight-expire')->everyFifteenMinutes()->withoutOverlapping();
        // Kurs JISDOR (ASUMSI A-84): hari kerja tiap jam 10:00-17:00 WIB, upsert idempoten 35 hari ke belakang.
        $schedule->command('rates:fetch')->weekdays()->hourly()->between('10:00', '17:00')->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
