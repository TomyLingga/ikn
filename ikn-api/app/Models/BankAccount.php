<?php

namespace App\Models;

use App\Support\Money;

// Rekening tujuan transfer manual. Rekening USD (ASUMSI A-86) membawa SWIFT, alamat bank, dan bank koresponden
// untuk instruksi bayar dan invoice ekspor; transfer manual hanya ke rekening se-mata-uang dengan order.
class BankAccount extends Model
{
    protected $fillable = [
        'bank_name', 'account_number', 'account_holder', 'currency', 'swift_code', 'bank_address', 'correspondent_bank',
        'is_active', 'sort_order',
    ];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForCurrency($query, string $currency)
    {
        return $query->where('currency', Money::normalizeCurrency($currency));
    }

    public function currencyCode(): string
    {
        return Money::normalizeCurrency($this->currency);
    }

    /** Bentuk kontrak (bankName, accountNumber, accountHolder, currency, swiftCode, bankAddress, correspondentBank). */
    public function toSummary(): array
    {
        return [
            'id' => $this->id,
            'bankName' => $this->bank_name,
            'accountNumber' => $this->account_number,
            'accountHolder' => $this->account_holder,
            'currency' => $this->currencyCode(),
            'swiftCode' => $this->swift_code,
            'bankAddress' => $this->bank_address,
            'correspondentBank' => $this->correspondent_bank,
        ];
    }
}
