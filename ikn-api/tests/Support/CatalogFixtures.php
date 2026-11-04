<?php

namespace Tests\Support;

use App\Models\Category;
use App\Models\DeliveryTerm;
use App\Models\FactoryLocation;
use App\Models\Fee;
use App\Models\Media;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ShippingRate;
use App\Models\ShippingZone;
use App\Models\Voucher;
use App\Services\Commerce\CommerceSettings;
use App\Services\Stock\StockLedger;
use Database\Seeders\DeliveryTermSeeder;
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

    /**
     * Lokasi pabrik (ASUMSI A-90). Migrasi sudah mengisi tanjung-morawa (urutan 1 = bawaan) dan sei-bamban (urutan 2);
     * tanpa $code mengubah pabrik bawaan, dengan kode baru membuat pabrik baru.
     */
    protected function factoryLocation(?string $code = null, array $attributes = []): FactoryLocation
    {
        $factory = $code === null
            ? FactoryLocation::orderBy('sort_order')->orderBy('id')->firstOrFail()
            : FactoryLocation::firstOrNew(['code' => $code], [
                'name' => ['id' => 'Pabrik '.ucfirst($code)], 'address' => 'Alamat '.$code, 'allows_pickup' => true,
                'sort_order' => (int) FactoryLocation::max('sort_order') + 1,
            ]);
        $factory->fill($attributes)->save();

        return $factory->fresh();
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

    /** @param  int  $amount  satuan terkecil mata uang (IDR rupiah, USD sen) */
    protected function makeFee(int $amount = 5000, bool $active = true, string $currency = 'IDR'): Fee
    {
        return Fee::create(['name' => ['id' => 'Biaya admin'], 'type' => Fee::TYPE_ADMIN, 'amount' => \App\Support\Money::fromMinor($amount, $currency), 'currency' => $currency, 'is_active' => $active]);
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

    /**
     * Cara serah terima untuk test (ASUMSI A-85). Migrasi sudah mengisi baris bawaan (Loco aktif urutan 1, Franco
     * NONAKTIF, FOB, CIF); di sini Franco (zona) dipaksa AKTIF dan urutan pertama agar quote/checkout tanpa
     * deliveryTermCode tetap memakai jalur tarif zona seperti sebelum phase E2, Loco aktif di urutan kedua.
     * Pakai updateOrCreate (bukan firstOrCreate) karena barisnya sudah ada.
     */
    protected function seedDeliveryTerms(): void
    {
        DeliveryTerm::updateOrCreate(['code' => 'franco'], [
            'name' => ['id' => 'Franco (diantar ke alamat)', 'en' => 'Franco (delivered to your address)'],
            'family' => DeliveryTerm::FAMILY_DOOR, 'market' => DeliveryTerm::MARKET_LOCAL, 'pricing_mode' => DeliveryTerm::PRICING_ZONE,
            'is_active' => true, 'sort_order' => 1,
        ]);
        DeliveryTerm::updateOrCreate(['code' => 'loco'], [
            'name' => ['id' => 'Loco (ambil di pabrik)', 'en' => 'Loco (pickup at factory)'],
            'family' => DeliveryTerm::FAMILY_PICKUP, 'market' => DeliveryTerm::MARKET_LOCAL, 'pricing_mode' => DeliveryTerm::PRICING_NONE,
            'is_active' => true, 'sort_order' => 2,
        ]);
    }

    /** Kembalikan ke baris bawaan migrasi/seeder (Loco aktif urutan 1, Franco nonaktif) setelah seedDeliveryTerms(). */
    protected function useDefaultDeliveryTerms(): void
    {
        foreach (DeliveryTermSeeder::rows() as $row) {
            DeliveryTerm::updateOrCreate(['code' => $row['code']], $row);
        }
    }

    /** Baris bawaan (fob, cif, ...) sudah ada dari migrasi, jadi kode yang sama diperbarui, bukan dibuat ulang. */
    protected function makeDeliveryTerm(array $attributes = []): DeliveryTerm
    {
        $code = $attributes['code'] ?? 'term-'.Str::lower(Str::random(6));

        return DeliveryTerm::updateOrCreate(['code' => $code], array_merge([
            'code' => $code, 'name' => ['id' => ucfirst($code)], 'family' => DeliveryTerm::FAMILY_DOOR,
            'market' => DeliveryTerm::MARKET_LOCAL, 'pricing_mode' => DeliveryTerm::PRICING_ZONE, 'is_active' => true, 'sort_order' => 0,
        ], $attributes));
    }
}
