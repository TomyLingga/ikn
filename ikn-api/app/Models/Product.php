<?php

namespace App\Models;

use App\Support\HasTranslations;
use App\Support\I18nList;
use App\Support\Money;
use Illuminate\Database\Eloquent\SoftDeletes;
use LogicException;

class Product extends Model
{
    use HasTranslations, SoftDeletes;

    public const PRICE_MODE_FIXED = 'fixed';
    public const PRICE_MODE_QUOTE = 'quote';
    public const PRICE_MODES = [self::PRICE_MODE_FIXED, self::PRICE_MODE_QUOTE];

    public const STOCK_IN_STOCK = 'in_stock';
    public const STOCK_MADE_TO_ORDER = 'made_to_order';
    public const STOCK_OUT_OF_STOCK = 'out_of_stock';
    public const STOCK_STATUSES = [self::STOCK_IN_STOCK, self::STOCK_MADE_TO_ORDER, self::STOCK_OUT_OF_STOCK];

    // stock_qty dan reserved_qty sengaja tidak fillable: hanya StockLedger yang menulisnya (arsitektur bagian 8).
    protected $fillable = [
        'slug', 'code', 'category_id', 'name', 'kind', 'summary', 'highlights', 'specs', 'applications',
        'solubility', 'aliases', 'price_mode', 'price', 'promo_price', 'promo_starts_at', 'promo_ends_at',
        'unit', 'moq', 'weight_gram', 'length_cm', 'width_cm', 'height_cm', 'stock_status', 'is_taxable', 'is_published', 'rating_avg', 'review_count',
    ];

    protected $translatable = ['name', 'summary'];

    // highlights/applications ({id: string[], en: string[]}) dinormalisasi lewat mutator I18nList, bukan cast.
    protected $casts = [
        'specs' => 'array',
        'solubility' => 'array',
        'aliases' => 'array',
        'moq' => 'integer',
        'weight_gram' => 'integer',
        'length_cm' => 'float',
        'width_cm' => 'float',
        'height_cm' => 'float',
        'stock_qty' => 'integer',
        'reserved_qty' => 'integer',
        'review_count' => 'integer',
        'is_taxable' => 'boolean',
        'is_published' => 'boolean',
        'promo_starts_at' => 'datetime',
        'promo_ends_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (Product $product) {
            // Guard: kolom cache stok tidak boleh diubah lewat Eloquent (StockLedger menulis lewat query builder).
            if ($product->isDirty(['stock_qty', 'reserved_qty'])) {
                throw new LogicException('products.stock_qty/reserved_qty may only be changed through App\Services\Stock\StockLedger.');
            }

            if ($product->price_mode === self::PRICE_MODE_QUOTE) {
                $product->price = null;
                $product->promo_price = null;
            }

            $product->stock_status = self::deriveStockStatus(
                (int) ($product->stock_qty ?? 0) - (int) ($product->reserved_qty ?? 0),
                (string) ($product->stock_status ?? self::STOCK_OUT_OF_STOCK)
            );
        });
    }

    /** Status stok turunan: made_to_order diatur manual, selain itu mengikuti available. */
    public static function deriveStockStatus(int $available, string $current): string
    {
        if ($current === self::STOCK_MADE_TO_ORDER) {
            return $current;
        }

        return $available > 0 ? self::STOCK_IN_STOCK : self::STOCK_OUT_OF_STOCK;
    }

    // ---- Relasi ----

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function stockMovements()
    {
        return $this->hasMany(StockMovement::class);
    }

    // ---- Scope ----

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    /** Pencarian ILIKE pada nama (id/en), kode, dan alias. */
    public function scopeSearch($query, ?string $term)
    {
        $term = trim((string) $term);
        if ($term === '') {
            return $query;
        }
        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $term).'%';

        return $query->where(function ($w) use ($like) {
            $w->where('name->id', 'ilike', $like)
                ->orWhere('name->en', 'ilike', $like)
                ->orWhere('code', 'ilike', $like)
                ->orWhere('slug', 'ilike', $like)
                ->orWhereRaw('aliases::text ilike ?', [$like]);
        });
    }

    // ---- Aksesor / helper ----

    public function getAvailableAttribute(): int
    {
        return (int) $this->stock_qty - (int) $this->reserved_qty;
    }

    public function getHighlightsAttribute($value): array
    {
        return I18nList::normalize(is_string($value) ? json_decode($value, true) : $value);
    }

    public function setHighlightsAttribute($value): void
    {
        $this->attributes['highlights'] = json_encode(I18nList::normalize($value), JSON_UNESCAPED_UNICODE);
    }

    public function getApplicationsAttribute($value): array
    {
        return I18nList::normalize(is_string($value) ? json_decode($value, true) : $value);
    }

    public function setApplicationsAttribute($value): void
    {
        $this->attributes['applications'] = json_encode(I18nList::normalize($value), JSON_UNESCAPED_UNICODE);
    }

    public function isFixedPrice(): bool
    {
        return $this->price_mode === self::PRICE_MODE_FIXED;
    }

    /** Volume kemasan per satuan jual (cm³) untuk ongkir; 0 bila dimensi belum lengkap (ASUMSI A-76). */
    public function volumeCm3(): int
    {
        if (! $this->length_cm || ! $this->width_cm || ! $this->height_cm) {
            return 0;
        }

        return (int) round((float) $this->length_cm * (float) $this->width_cm * (float) $this->height_cm);
    }

    /** @return array{lengthCm: float|null, widthCm: float|null, heightCm: float|null, volumeCm3: int} */
    public function dimensions(): array
    {
        return [
            'lengthCm' => $this->length_cm === null ? null : (float) $this->length_cm,
            'widthCm' => $this->width_cm === null ? null : (float) $this->width_cm,
            'heightCm' => $this->height_cm === null ? null : (float) $this->height_cm,
            'volumeCm3' => $this->volumeCm3(),
        ];
    }

    public function priceInt(): ?int
    {
        return $this->price === null ? null : Money::toInt($this->price);
    }

    public function promoActive(): bool
    {
        if ($this->promo_price === null || ! $this->isFixedPrice()) {
            return false;
        }
        $now = now();
        if ($this->promo_starts_at && $this->promo_starts_at->gt($now)) {
            return false;
        }
        if ($this->promo_ends_at && $this->promo_ends_at->lt($now)) {
            return false;
        }

        return Money::toInt($this->promo_price) < (int) $this->priceInt();
    }

    /** Harga berlaku sekarang (promo bila aktif); null untuk price_mode=quote. */
    public function effectivePrice(): ?int
    {
        if (! $this->isFixedPrice()) {
            return null;
        }

        return $this->promoActive() ? Money::toInt($this->promo_price) : $this->priceInt();
    }

    /**
     * Foto thumbnail (kartu produk, keranjang, snapshot order): foto yang ditandai admin, atau foto pertama
     * menurut urutan. Video tidak pernah menjadi thumbnail (ASUMSI A-72).
     */
    public function thumbnailImage(): ?ProductImage
    {
        $images = $this->relationLoaded('images') ? $this->images : $this->images()->with('media')->get();
        $photos = $images->filter(fn (ProductImage $image) => $image->media && $image->media->isImage());

        return $photos->firstWhere('is_thumbnail', true) ?? $photos->first();
    }

    /** URL foto thumbnail atau null. */
    public function primaryImageUrl(): ?string
    {
        $thumbnail = $this->thumbnailImage();

        return $thumbnail ? $thumbnail->media->url() : null;
    }

    /** Hitung ulang rating_avg dan review_count dari ulasan tayang. */
    public function refreshRating(): void
    {
        $stats = $this->reviews()->where('is_published', true)
            ->selectRaw('COALESCE(AVG(rating), 0) AS avg, COUNT(*) AS cnt')->first();

        $this->forceFill([
            'rating_avg' => round((float) ($stats->avg ?? 0), 2),
            'review_count' => (int) ($stats->cnt ?? 0),
        ])->save();
    }
}
