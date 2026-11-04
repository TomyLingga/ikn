<?php

namespace App\Console\Commands;

use App\Exceptions\ApiException;
use App\Services\Rates\ExchangeRateService;
use App\Services\Rates\JisdorClient;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Throwable;

// Terjadwal hari kerja tiap jam 10:00-17:00 WIB (ASUMSI A-84): ambil JISDOR USD 35 hari ke belakang dan upsert.
// Gagal apa pun (upstream, parser, DB) hanya dicatat ke log (exit 1) agar scheduler tidak ikut jatuh; jawaban
// kosong untuk rentang yang memuat hari kerja juga dicatat sebagai peringatan (BI mengubah format/layanan mati).
class RatesFetch extends Command
{
    protected $signature = 'rates:fetch {--from= : Tanggal awal (Y-m-d), bawaan 35 hari lalu} {--to= : Tanggal akhir (Y-m-d), bawaan hari ini} {--dry-run : Tampilkan jumlah baris tanpa menulis}';

    protected $description = 'Fetch JISDOR USD/IDR rates from Bank Indonesia into exchange_rates';

    public function handle(JisdorClient $client, ExchangeRateService $rates): int
    {
        $tz = config('app.timezone');
        $today = now()->setTimezone($tz)->startOfDay();
        $from = $this->option('from') ? Carbon::parse($this->option('from'), $tz)->startOfDay() : $today->copy()->subDays(35);
        $to = $this->option('to') ? Carbon::parse($this->option('to'), $tz)->startOfDay() : $today;
        $range = ['from' => $from->format('Y-m-d'), 'to' => $to->format('Y-m-d')];

        try {
            $rows = $client->fetch($from, $to);
        } catch (Throwable $e) {
            Log::warning('rates:fetch failed', [
                'code' => $e instanceof ApiException ? $e->errorCode : get_class($e),
                'message' => $e->getMessage(),
            ] + $range);
            $this->error('JISDOR fetch failed: '.$e->getMessage());

            return self::FAILURE;
        }

        if ($rows === [] && $this->rangeHasWeekday($from, $to)) {
            Log::warning('rates:fetch returned no rows', $range);
            $this->warn('JISDOR returned no USD rows although the range contains working days.');
        }

        if ($this->option('dry-run')) {
            $this->info(sprintf('%d rate(s) fetched (%s..%s), nothing written (dry run).', count($rows), $range['from'], $range['to']));

            return self::SUCCESS;
        }

        try {
            $count = $rates->upsertJisdor($rows);
        } catch (Throwable $e) {
            Log::warning('rates:fetch failed', ['code' => get_class($e), 'message' => $e->getMessage()] + $range);
            $this->error('JISDOR upsert failed: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf('%d rate(s) upserted (%s..%s).', $count, $range['from'], $range['to']));

        return self::SUCCESS;
    }

    /** Ada Senin-Jumat di rentang (inklusif)? Rentang 7 hari atau lebih selalu memuat hari kerja. */
    private function rangeHasWeekday(Carbon $from, Carbon $to): bool
    {
        if ($from->diffInDays($to) >= 6) {
            return true;
        }

        for ($day = $from->copy(); $day->lte($to); $day->addDay()) {
            if ($day->isWeekday()) {
                return true;
            }
        }

        return false;
    }
}
