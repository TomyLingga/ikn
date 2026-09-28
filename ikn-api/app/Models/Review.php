<?php

namespace App\Models;

// Ulasan produk (ASUMSI A-13): langsung tayang, admin bisa menyembunyikan. order_id diisi BE-3 saat ulasan dari order completed.
class Review extends Model
{
    protected $fillable = ['product_id', 'user_id', 'order_id', 'rating', 'body', 'is_published'];

    protected $casts = ['rating' => 'integer', 'order_id' => 'integer', 'is_published' => 'boolean'];

    protected static function booted(): void
    {
        $refresh = function (Review $review) {
            $product = $review->product()->withTrashed()->first();
            if ($product) {
                $product->refreshRating();
            }
        };
        static::saved($refresh);
        static::deleted($refresh);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }
}
