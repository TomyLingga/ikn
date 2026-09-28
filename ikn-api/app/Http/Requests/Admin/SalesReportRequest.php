<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

// GET /admin/reports/sales?year&month&from&to&format=csv (kontrak 11.1). from/to (tanggal) mengalahkan year/month.
class SalesReportRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'format' => ['nullable', 'string', 'in:json,csv'],
        ];
    }

    public function wantsCsv(): bool
    {
        return ($this->validated()['format'] ?? 'json') === 'csv';
    }

    /** @return array{from: Carbon, to: Carbon, year: int, month: ?int} rentang inklusif di zona aplikasi */
    public function period(): array
    {
        $data = $this->validated();
        $tz = config('app.timezone');
        $now = now()->setTimezone($tz);

        if (! empty($data['from']) || ! empty($data['to'])) {
            $from = ! empty($data['from']) ? Carbon::parse($data['from'], $tz)->startOfDay() : $now->copy()->startOfYear();
            $to = ! empty($data['to']) ? Carbon::parse($data['to'], $tz)->endOfDay() : $now->copy()->endOfDay();

            return ['from' => $from, 'to' => $to, 'year' => (int) $from->year, 'month' => null];
        }

        $year = (int) ($data['year'] ?? $now->year);
        $month = isset($data['month']) ? (int) $data['month'] : null;
        $from = Carbon::create($year, $month ?? 1, 1, 0, 0, 0, $tz);
        $to = $month ? $from->copy()->endOfMonth() : $from->copy()->endOfYear();

        return ['from' => $from, 'to' => $to, 'year' => $year, 'month' => $month];
    }
}
