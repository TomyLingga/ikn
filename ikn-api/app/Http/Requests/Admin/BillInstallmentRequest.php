<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

// POST /admin/orders/{number}/installments/{id}/bill (ASUMSI A-97): { dueAt? } ISO-8601. Tanpa dueAt, termin yang belum
// ditagih jatuh tempo sekarang + dueDays jadwalnya; termin yang sudah ditagih wajib dueAt (mengubah jatuh tempo).
class BillInstallmentRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'dueAt' => ['nullable', 'date'],
        ];
    }

    public function dueAt(): ?Carbon
    {
        $value = $this->validated()['dueAt'] ?? null;

        return $value ? Carbon::parse($value) : null;
    }
}
