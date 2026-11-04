<?php

namespace App\Services\Rates;

use App\Http\Resources\ExchangeRateResource;
use App\Models\ExchangeRate;
use Illuminate\Support\Carbon;

// Satu pintu tulis/baca tabel exchange_rates (ASUMSI A-84). Hari kerja = Senin-Jumat; libur nasional tidak dimodelkan.
class ExchangeRateService
{
    public const STALE_AFTER_WEEKDAYS = 3;

    /**
     * Upsert per (date, currency); kurs resmi JISDOR menimpa baris manual pada tanggal yang sama.
     *
     * @param  array<int, array{date: string, rate: string|int|float}>  $rows
     * @return int jumlah baris yang dikirim ke upsert
     */
    public function upsertJisdor(array $rows): int
    {
        if ($rows === []) {
            return 0;
        }

        $now = now();
        $values = [];
        foreach ($rows as $row) {
            $values[$row['date']] = [
                'date' => $row['date'],
                'currency' => ExchangeRate::CURRENCY_USD,
                'rate' => number_format((float) $row['rate'], 2, '.', ''),
                'source' => ExchangeRate::SOURCE_JISDOR,
                'fetched_at' => $now,
            ];
        }

        ExchangeRate::upsert(array_values($values), ['date', 'currency'], ['rate', 'source', 'fetched_at']);

        return count($values);
    }

    public function setManual(Carbon $date, int $rate): ExchangeRate
    {
        return ExchangeRate::updateOrCreate(
            ['date' => $date->format('Y-m-d'), 'currency' => ExchangeRate::CURRENCY_USD],
            ['rate' => $rate, 'source' => ExchangeRate::SOURCE_MANUAL, 'fetched_at' => null],
        );
    }

    /** Bentuk respons GET /admin/exchange-rates (kontrak 11.7). */
    public function summary(Carbon $from, Carbon $to): array
    {
        $today = now()->setTimezone(config('app.timezone'))->startOfDay();

        $latest = ExchangeRate::where('currency', ExchangeRate::CURRENCY_USD)
            ->where('date', '<=', $today->format('Y-m-d'))
            ->orderByDesc('date')
            ->first();

        $series = ExchangeRate::where('currency', ExchangeRate::CURRENCY_USD)
            ->where('date', '>=', $from->format('Y-m-d'))
            ->where('date', '<=', $to->format('Y-m-d'))
            ->orderBy('date')
            ->get();

        $rates = $series->map(fn (ExchangeRate $row) => $row->rateInt());
        $staleDays = $latest ? $this->weekdaysAfter($latest->date, $today) : 0;
        $fetchedAt = ExchangeRate::where('currency', ExchangeRate::CURRENCY_USD)->max('fetched_at');

        return [
            'latest' => $latest ? (new ExchangeRateResource($latest))->toArray(request()) : null,
            'average' => $rates->isEmpty() ? null : (int) round($rates->avg()),
            'max' => $rates->isEmpty() ? null : (int) $rates->max(),
            'min' => $rates->isEmpty() ? null : (int) $rates->min(),
            'series' => $series->map(fn (ExchangeRate $row) => $row->toSummary())->values()->all(),
            'fetchedAt' => $fetchedAt ? Carbon::parse($fetchedAt)->toApiString() : null,
            'staleDays' => $staleDays,
            'stale' => $staleDays > self::STALE_AFTER_WEEKDAYS,
        ];
    }

    /** Jumlah hari kerja (Senin-Jumat) setelah $from sampai dengan $to; 0 bila $from >= $to. */
    private function weekdaysAfter(Carbon $from, Carbon $to): int
    {
        $count = 0;
        $day = $from->copy()->startOfDay()->addDay();
        $end = $to->copy()->startOfDay();

        while ($day->lte($end)) {
            if ($day->isWeekday()) {
                $count++;
            }
            $day->addDay();
        }

        return $count;
    }
}
