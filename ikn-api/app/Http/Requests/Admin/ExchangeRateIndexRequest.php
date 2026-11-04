<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

// GET /admin/exchange-rates?from&to (kontrak 11.7). Bawaan 30 hari terakhir, inklusif, zona aplikasi.
class ExchangeRateIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ];
    }

    public function attributes(): array
    {
        $attributes = __('rates.attributes');

        return is_array($attributes) ? $attributes : [];
    }

    /** @return array{from: Carbon, to: Carbon} */
    public function period(): array
    {
        $data = $this->validated();
        $tz = config('app.timezone');
        $today = now()->setTimezone($tz)->startOfDay();

        $to = ! empty($data['to']) ? Carbon::parse($data['to'], $tz)->startOfDay() : $today;
        $from = ! empty($data['from']) ? Carbon::parse($data['from'], $tz)->startOfDay() : $to->copy()->subDays(30);

        return ['from' => $from, 'to' => $to];
    }
}
