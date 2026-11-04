<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Validator;

// POST /admin/orders/{number}/freight-quotes (kontrak 11.12, ASUMSI A-89): rincian baris ongkir CIF 1..10 baris,
// amount satuan terkecil mata uang order (USD sen), total > 0, validUntil opsional (kosong = setting freightQuoteValidDays).
class FreightQuoteRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $lines = $this->input('lines');
        if (is_array($lines)) {
            $lines = array_values(array_map(function ($line) {
                if (is_array($line) && isset($line['label']) && is_string($line['label'])) {
                    $line['label'] = trim(preg_replace('/\s+/u', ' ', $line['label']));
                }

                return $line;
            }, $lines));
            $this->merge(['lines' => $lines]);
        }
        if (is_string($this->input('note'))) {
            $this->merge(['note' => trim($this->input('note'))]);
        }
    }

    public function rules(): array
    {
        return [
            'lines' => ['required', 'array', 'min:1', 'max:10'],
            'lines.*.label' => ['required', 'string', 'max:80'],
            'lines.*.amount' => ['required', 'integer', 'min:0', 'max:999999999999'],
            'validUntil' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $lines = $this->input('lines');
            if (is_array($lines) && ! $v->errors()->has('lines') && array_sum(array_map(fn ($l) => (int) (is_array($l) ? ($l['amount'] ?? 0) : 0), $lines)) <= 0) {
                $v->errors()->add('lines', __('commerce.freight_quote_total_required'));
            }
        });
    }

    /** @return array<int, array{label:string, amount:int}> */
    public function lines(): array
    {
        return array_map(fn ($line) => ['label' => (string) $line['label'], 'amount' => (int) $line['amount']], $this->validated()['lines']);
    }

    /** Masa berlaku: tanggal saja = akhir hari itu (zona aplikasi); null = bawaan setting. */
    public function validUntil(): ?Carbon
    {
        return self::parseValidUntil($this->validated()['validUntil'] ?? null);
    }

    public static function parseValidUntil(?string $value): ?Carbon
    {
        if ($value === null || trim($value) === '') {
            return null;
        }
        $date = Carbon::parse($value, config('app.timezone'));

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', trim($value)) ? $date->endOfDay() : $date;
    }
}
