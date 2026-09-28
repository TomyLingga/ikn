<?php

namespace App\Models;

use App\Support\Money;

// Item order dengan snapshot produk (harga saat checkout tidak berubah bila produk diedit).
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

    public function unitPriceInt(): int
    {
        return Money::toInt($this->unit_price);
    }

    public function discountAmountInt(): int
    {
        return Money::toInt($this->discount_amount);
    }

    public function taxAmountInt(): int
    {
        return Money::toInt($this->tax_amount);
    }

    public function lineTotalInt(): int
    {
        return Money::toInt($this->line_total);
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
