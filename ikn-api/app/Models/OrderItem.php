<?php

namespace App\Models;

use App\Support\Money;

// Item order dengan snapshot produk (harga saat checkout tidak berubah bila produk diedit).
// Mata uang disalin dari order (ASUMSI A-86); helper *Int() mengembalikan satuan terkecil mata uang itu.
class OrderItem extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'product_snapshot' => 'array',
        'qty' => 'integer',
        'weight_gram' => 'integer',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function currencyCode(): string
    {
        return Money::normalizeCurrency($this->currency);
    }

    private function minor($value): int
    {
        return Money::toMinor($value, $this->currencyCode()) ?? 0;
    }

    public function unitPriceInt(): int
    {
        return $this->minor($this->unit_price);
    }

    public function discountAmountInt(): int
    {
        return $this->minor($this->discount_amount);
    }

    public function taxAmountInt(): int
    {
        return $this->minor($this->tax_amount);
    }

    public function lineTotalInt(): int
    {
        return $this->minor($this->line_total);
    }

    public function productSlug(): ?string
    {
        return $this->product_snapshot['slug'] ?? null;
    }

    /** @return array{id:string,en:string} */
    public function productName(): array
    {
        $name = $this->product_snapshot['name'] ?? ['id' => '', 'en' => ''];

        return is_array($name) ? $name : ['id' => (string) $name, 'en' => (string) $name];
    }
}
