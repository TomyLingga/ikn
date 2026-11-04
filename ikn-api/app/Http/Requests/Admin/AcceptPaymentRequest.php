<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;

// POST /admin/payments/{id}/accept: { receivedAmount?, bankCharges?, receivedNote? } (kontrak 11.2, ASUMSI A-86).
// Semua opsional dan informasi saja (satuan terkecil mata uang payment); admin tetap yang memutuskan terima/tolak.
class AcceptPaymentRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'receivedAmount' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'bankCharges' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'receivedNote' => ['nullable', 'string', 'max:255'],
        ];
    }

    /** @return array{receivedAmount:?int, bankCharges:?int, receivedNote:?string} */
    public function received(): array
    {
        $data = $this->validated();

        return [
            'receivedAmount' => isset($data['receivedAmount']) ? (int) $data['receivedAmount'] : null,
            'bankCharges' => isset($data['bankCharges']) ? (int) $data['bankCharges'] : null,
            'receivedNote' => isset($data['receivedNote']) && trim((string) $data['receivedNote']) !== '' ? trim((string) $data['receivedNote']) : null,
        ];
    }
}
