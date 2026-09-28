<?php

namespace App\Models;

class BankAccount extends Model
{
    protected $fillable = ['bank_name', 'account_number', 'account_holder', 'is_active', 'sort_order'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /** Bentuk kontrak (bankName, accountNumber, accountHolder). */
    public function toSummary(): array
    {
        return [
            'id' => $this->id,
            'bankName' => $this->bank_name,
            'accountNumber' => $this->account_number,
            'accountHolder' => $this->account_holder,
        ];
    }
}
