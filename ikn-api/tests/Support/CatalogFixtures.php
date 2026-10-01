<?php

namespace Tests\Support;

use App\Models\Category;
use App\Models\Fee;
use App\Models\Media;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ShippingRate;
use App\Models\ShippingZone;
use App\Models\Voucher;
use App\Services\Commerce\CommerceSettings;
use App\Services\Stock\StockLedger;
use Illuminate\Support\Str;

// Fixture katalog untuk test BE-2 (tanpa factory agar stok hanya lewat StockLedger).
trait CatalogFixtures
{
    protected function makeCategory(array $attributes = []): Category
    {
        $slug = $attributes['slug'] ?? 'kategori-'.Str::lower(Str::random(6));

        return Category::create(array_merge(['slug' => $slug, 'name' => ['id' => ucfirst($slug)], 'is_active' => true], $attributes));
    }

    protected function makeProduct(array $attributes = [], int $stock = 0, ?Category $category = null): Product
    {
        $category = $category ?? Category::first() ?? $this->makeCategory();
        $slug = $attributes['slug'] ?? 'produk-'.Str::lower(Str::random(6));

        $product = Product::create(array_merge([
            'slug' => $slug,
            'code' => strtoupper($slug),
            'category_id' => $category->id,
            'name' => ['id' => ucfirst(str_replace('-', ' ', $slug))],
            'price_mode' => Product::PRICE_MODE_FIXED,
            'price' => 100000,
            'unit' => 'pcs',
            'moq' => 1,
            'weight_gram' => 1000,
            'is_taxable' => true,
            'is_published' => true,
        ], $attributes));

        if ($stock > 0) {
            app(StockLedger::class)->in($product, $stock, 'test');
        }

        return $product->fresh();
    }

    protected function makeMedia(string $name = 'foto.jpg', string $collection = 'products'): Media
    {
        return Media::create([
            'disk' => 'public', 'path' => $collection.'/'.Str::random(8).'.jpg', 'original_name' => $name,
            'mime' => 'image/jpeg', 'size' => 1234, 'collection' => $collection,
        ]);
    }

    protected function makeZone(array $regions, array $rate = [], array $zone = []): ShippingZone
    {
        $zone = ShippingZone::create(array_merge(['name' => ['id' => 'Zona'], 'is_active' => true, 'priority' => 0], $zone));
        foreach ($regions as [$code, $level]) {
            $zone->regions()->create(['region_code' => $code, 'level' => $level]);
        }
        if ($rate !== []) {
            $this->makeRate($zone, $rate);
        }

        return $zone;
    }

    protected function makeRate(ShippingZone $zone, array $attributes = []): ShippingRate
    {
        return $zone->rates()->create(array_merge([
            'name' => ['id' => 'Reguler'], 'type' => ShippingRate::TYPE_CALCULATED,
            'base_amount' => 20000, 'per_kg_amount' => 2000, 'min_amount' => 0, 'free_above' => null,
            'eta' => ['id' => '2–4 hari'], 'is_active' => true, 'sort_order' => 0,
        ], $attributes));
    }

    protected function makeVoucher(array $attributes = []): Voucher
    {
        return Voucher::create(array_merge([
            'code' => 'TEST'.strtoupper(Str::random(4)), 'type' => Voucher::TYPE_PERCENT, 'value' => 10,
            'min_subtotal' => 0, 'max_discount' => null, 'quota' => null, 'used_count' => 0, 'per_user_limit' => null,
            'scope' => ['type' => Voucher::SCOPE_ALL], 'starts_at' => null, 'ends_at' => null, 'is_active' => true,
        ], $attributes));
    }

    protected function makeFee(int $amount = 5000, bool $active = true): Fee
    {
        return Fee::create(['name' => ['id' => 'Biaya admin'], 'type' => Fee::TYPE_ADMIN, 'amount' => $amount, 'is_active' => $active]);
    }

    protected function makePaymentMethod(string $code = 'manual_transfer', array $attributes = []): PaymentMethod
    {
        return PaymentMethod::create(array_merge([
            'code' => $code, 'type' => $code, 'driver' => PaymentMethod::DRIVER_MANUAL,
            'name' => ['id' => ucfirst($code)], 'instructions' => ['id' => 'Instruksi'], 'config' => [], 'is_active' => true, 'sort_order' => 0,
        ], $attributes));
    }

    protected function commerceSettings(array $values): void
    {
        app(CommerceSettings::class)->update($values);
        app(CommerceSettings::class)->forget();
    }
}
