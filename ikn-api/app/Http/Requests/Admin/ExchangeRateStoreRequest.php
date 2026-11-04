<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

// POST /admin/exchange-rates (kontrak 11.7): kurs manual cadangan, menimpa tanggal yang sama.
class ExchangeRateStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date', 'before_or_equal:today'],
            'rate' => ['required', 'integer', 'min:1000', 'max:1000000'],
        ];
    }

    public function attributes(): array
    {
        $attributes = __('rates.attributes');

        return is_array($attributes) ? $attributes : [];
    }

    // Nama berbeda dari Request::date()/input() yang sudah ada di Laravel.
    public function rateDate(): Carbon
    {
        return Carbon::parse($this->validated()['date'], config('app.timezone'))->startOfDay();
    }

    public function rateValue(): int
    {
        return (int) $this->validated()['rate'];
    }
}
