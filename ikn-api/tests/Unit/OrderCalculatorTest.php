<?php

namespace Tests\Unit;

use App\Exceptions\ApiException;
use App\Models\Product;
use App\Models\ShippingRate;
use App\Models\User;
use App\Models\Voucher;
use App\Services\Commerce\OrderCalculator;
use App\Services\Commerce\QuoteResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\Support\CatalogFixtures;
use Tests\TestCase;

/**
 * OrderCalculator (arsitektur bagian 9). Angka yang diharapkan dihitung manual di tiap test:
 * pajak inklusif = round(base × r / (100 + r)), eksklusif = round(base × r / 100), rupiah bulat half-up.
 */
class OrderCalculatorTest extends TestCase
{
    use RefreshDatabase, CatalogFixtures;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = $this->customer();
    }

    private function quote(array $items, $address = null, ?int $rateId = null, ?string $voucher = null, ?string $method = null): QuoteResult
    {
        return app(OrderCalculator::class)->quote($this->user, $items, $address, $rateId, $voucher, $method);
    }

    public function test_inclusive_tax_is_informational_and_exclusive_tax_is_added(): void
    {
        $product = $this->makeProduct(['price' => 100000], 100);
        $items = [['productSlug' => $product->slug, 'qty' => 10]];

        $this->commerceSettings(['taxRate' => 11, 'priceIncludesTax' => true]);
        $inclusive = $this->quote($items);
        $this->assertSame(1000000, $inclusive->subtotal);
        $this->assertSame(99099, $inclusive->taxTotal); // 1.000.000 × 11 / 111 = 99.099,099…
        $this->assertSame(1000000, $inclusive->grandTotal);
        $this->assertTrue($inclusive->priceIncludesTax);

        $this->commerceSettings(['priceIncludesTax' => false]);
        $exclusive = $this->quote($items);
        $this->assertSame(110000, $exclusive->taxTotal);
        $this->assertSame(1110000, $exclusive->grandTotal);
        $this->assertSame(110000, $exclusive->items[0]['taxAmount']);
    }

    public function test_non_taxable_items_are_excluded_from_tax(): void
    {
        $taxable = $this->makeProduct(['price' => 100000], 10);
        $exempt = $this->makeProduct(['price' => 100000, 'is_taxable' => false], 10);
        $this->commerceSettings(['taxRate' => 11, 'priceIncludesTax' => false]);

        $quote = $this->quote([['productSlug' => $taxable->slug, 'qty' => 1], ['productSlug' => $exempt->slug, 'qty' => 1]]);

        $this->assertSame(11000, $quote->taxTotal);
        $this->assertSame(0, $quote->items[1]['taxAmount']);
        $this->assertSame(211000, $quote->grandTotal);
    }

    public function test_percent_voucher_is_capped_by_max_discount(): void
    {
        $product = $this->makeProduct(['price' => 100000], 100);
        $voucher = $this->makeVoucher(['type' => Voucher::TYPE_PERCENT, 'value' => 10, 'max_discount' => 50000]);

        $quote = $this->quote([['productSlug' => $product->slug, 'qty' => 10]], null, null, $voucher->code);

        $this->assertSame(50000, $quote->discountTotal); // 10% = 100.000, dibatasi 50.000
        $this->assertSame(950000, $quote->grandTotal);
        $this->assertSame(['id' => $voucher->id, 'code' => $voucher->code, 'type' => 'percent', 'value' => 10.0], $quote->voucher->toSummary());
    }

    public function test_fixed_voucher_larger_than_subtotal_is_limited_to_subtotal(): void
    {
        $product = $this->makeProduct(['price' => 100000], 100);
        $voucher = $this->makeVoucher(['type' => Voucher::TYPE_FIXED, 'value' => 5000000]);

        $quote = $this->quote([['productSlug' => $product->slug, 'qty' => 2]], null, null, $voucher->code);

        $this->assertSame(200000, $quote->discountTotal);
        $this->assertSame(0, $quote->grandTotal);
        $this->assertSame(0, $quote->taxTotal);
    }

    public function test_discount_is_allocated_proportionally_and_sums_exactly(): void
    {
        $a = $this->makeProduct(['price' => 100000], 10);
        $b = $this->makeProduct(['price' => 50000], 10);
        $voucher = $this->makeVoucher(['type' => Voucher::TYPE_FIXED, 'value' => 10001]);
        $this->commerceSettings(['taxRate' => 11, 'priceIncludesTax' => true]);

        $quote = $this->quote([['productSlug' => $a->slug, 'qty' => 1], ['productSlug' => $b->slug, 'qty' => 1]], null, null, $voucher->code);

        $this->assertSame(6667, $quote->items[0]['discountAmount']); // round(10001 × 100000/150000)
        $this->assertSame(3334, $quote->items[1]['discountAmount']);
        $this->assertSame(10001, $quote->items[0]['discountAmount'] + $quote->items[1]['discountAmount']);
        $this->assertSame($quote->taxTotal, $quote->items[0]['taxAmount'] + $quote->items[1]['taxAmount']);
        $this->assertSame(139999, $quote->grandTotal);
    }

    public function test_category_scoped_voucher_only_discounts_matching_items(): void
    {
        $catA = $this->makeCategory();
        $catB = $this->makeCategory();
        $a = $this->makeProduct(['price' => 100000], 10, $catA);
        $b = $this->makeProduct(['price' => 50000], 10, $catB);
        $voucher = $this->makeVoucher(['value' => 10, 'scope' => ['type' => Voucher::SCOPE_CATEGORY, 'categoryIds' => [$catB->id]]]);

        $quote = $this->quote([['productSlug' => $a->slug, 'qty' => 1], ['productSlug' => $b->slug, 'qty' => 1]], null, null, $voucher->code);

        $this->assertSame(5000, $quote->discountTotal);
        $this->assertSame(0, $quote->items[0]['discountAmount']);
        $this->assertSame(5000, $quote->items[1]['discountAmount']);

        // Keranjang tanpa item kategori B → scope tidak terpenuhi.
        try {
            $this->quote([['productSlug' => $a->slug, 'qty' => 1]], null, null, $voucher->code);
            $this->fail('expected VOUCHER_INVALID');
        } catch (ApiException $e) {
            $this->assertSame('VOUCHER_INVALID', $e->errorCode);
            $this->assertSame('scope', $e->meta['reason']);
        }
    }

    public function test_expired_and_unknown_vouchers_are_rejected_with_reason(): void
    {
        $product = $this->makeProduct(['price' => 100000], 10);
        $expired = $this->makeVoucher(['ends_at' => now()->subDay()]);
        $items = [['productSlug' => $product->slug, 'qty' => 1]];

        foreach ([$expired->code => 'expired', 'TIDAK-ADA' => 'not_found'] as $code => $reason) {
            try {
                $this->quote($items, null, null, $code);
                $this->fail('expected VOUCHER_INVALID');
            } catch (ApiException $e) {
                $this->assertSame(409, $e->status);
                $this->assertSame('VOUCHER_INVALID', $e->errorCode);
                $this->assertSame($reason, $e->meta['reason']);
            }
        }

        $minimum = $this->makeVoucher(['min_subtotal' => 500000]);
        try {
            $this->quote($items, null, null, $minimum->code);
            $this->fail('expected VOUCHER_INVALID');
        } catch (ApiException $e) {
            $this->assertSame('min_subtotal', $e->meta['reason']);
            $this->assertSame(500000, $e->meta['minSubtotal']);
        }
    }

    public function test_free_shipping_above_threshold(): void
    {
        $product = $this->makeProduct(['price' => 100000, 'weight_gram' => 1000], 100);
        $zone = $this->makeZone([['12', 'province']], ['base_amount' => 25000, 'per_kg_amount' => 2000, 'free_above' => 500000]);
        $rate = $zone->rates()->first();
        $address = ['provinceCode' => '12', 'regencyCode' => '12.71'];

        $paid = $this->quote([['productSlug' => $product->slug, 'qty' => 3]], $address, $rate->id);
        $this->assertSame(31000, $paid->shippingTotal); // 25.000 + 2.000 × 3 kg
        $this->assertSame(331000, $paid->grandTotal);
        $this->assertSame($rate->id, $paid->shipping['rateId']);
        $this->assertSame(3000, $paid->shipping['weightGram']);
        $this->assertCount(1, $paid->availableShippingRates);

        $free = $this->quote([['productSlug' => $product->slug, 'qty' => 10]], $address, $rate->id);
        $this->assertSame(0, $free->shippingTotal);
        $this->assertSame(1000000, $free->grandTotal);
    }

    public function test_per_kg_rounds_weight_up_and_min_amount_applies(): void
    {
        $product = $this->makeProduct(['price' => 10000, 'weight_gram' => 1250], 100);
        $zone = $this->makeZone([['12', 'province']]);
        $perKg = $this->makeRate($zone, ['base_amount' => 20000, 'per_kg_amount' => 2000]);
        $minimum = $this->makeRate($zone, ['base_amount' => 10000, 'per_kg_amount' => 1000, 'min_amount' => 30000]);
        $flat = $this->makeRate($zone, ['type' => ShippingRate::TYPE_FLAT, 'base_amount' => 15000, 'per_kg_amount' => 99999]);
        $address = ['province_code' => '12'];

        $quote = $this->quote([['productSlug' => $product->slug, 'qty' => 2]], $address, $perKg->id); // 2.500 g → 3 kg
        $this->assertSame(26000, $quote->shippingTotal);

        $this->assertSame(30000, $this->quote([['productSlug' => $product->slug, 'qty' => 2]], $address, $minimum->id)->shippingTotal);
        $this->assertSame(15000, $this->quote([['productSlug' => $product->slug, 'qty' => 2]], $address, $flat->id)->shippingTotal);
    }

    public function test_most_specific_zone_wins_and_default_zone_is_fallback(): void
    {
        $product = $this->makeProduct(['price' => 10000], 100);
        $province = $this->makeZone([['12', 'province']], ['type' => 'flat', 'base_amount' => 10000]);
        $regency = $this->makeZone([['12.71', 'regency']], ['type' => 'flat', 'base_amount' => 20000]);
        $default = $this->makeZone([], ['type' => 'flat', 'base_amount' => 90000], ['is_default' => true]);

        $inRegency = $this->quote([['productSlug' => $product->slug, 'qty' => 1]], ['provinceCode' => '12', 'regencyCode' => '12.71']);
        $this->assertSame($regency->id, $inRegency->availableShippingRates[0]['zoneId']);

        $inProvince = $this->quote([['productSlug' => $product->slug, 'qty' => 1]], ['provinceCode' => '12', 'regencyCode' => '12.01']);
        $this->assertSame($province->id, $inProvince->availableShippingRates[0]['zoneId']);

        $elsewhere = $this->quote([['productSlug' => $product->slug, 'qty' => 1]], (object) ['province_code' => '99']);
        $this->assertSame($default->id, $elsewhere->availableShippingRates[0]['zoneId']);
        $this->assertSame(90000, $elsewhere->availableShippingRates[0]['amount']);

        // Rate dari zona lain tidak boleh dipilih.
        $this->expectException(ValidationException::class);
        $this->quote([['productSlug' => $product->slug, 'qty' => 1]], ['provinceCode' => '99'], $province->rates()->first()->id);
    }

    public function test_without_address_shipping_is_null_and_rates_empty(): void
    {
        $product = $this->makeProduct(['price' => 10000], 100);
        $this->makeZone([], ['type' => 'flat', 'base_amount' => 90000], ['is_default' => true]);

        $quote = $this->quote([['productSlug' => $product->slug, 'qty' => 1]], null, 123);

        $this->assertNull($quote->shipping);
        $this->assertSame([], $quote->availableShippingRates);
        $this->assertContains('shipping_rate_ignored_without_address', $quote->warnings);
    }

    public function test_active_fees_are_added_and_inactive_ignored(): void
    {
        $product = $this->makeProduct(['price' => 100000], 10);
        $this->makeFee(5000, true);
        $this->makeFee(7000, false);

        $quote = $this->quote([['productSlug' => $product->slug, 'qty' => 1]]);

        $this->assertSame(5000, $quote->feeTotal);
        $this->assertCount(1, $quote->fees);
        $this->assertSame(105000, $quote->grandTotal);
    }

    public function test_unique_code_only_for_manual_transfer_when_enabled(): void
    {
        $product = $this->makeProduct(['price' => 100000], 10);
        $this->makePaymentMethod('manual_transfer');
        $this->makePaymentMethod('qris_static');
        $items = [['productSlug' => $product->slug, 'qty' => 1]];

        $this->commerceSettings(['uniqueCodeEnabled' => true]);
        $manual = $this->quote($items, null, null, null, 'manual_transfer');
        $this->assertTrue($manual->uniqueCodeRequired);
        $this->assertGreaterThanOrEqual(1, $manual->uniqueCode);
        $this->assertLessThanOrEqual(999, $manual->uniqueCode);
        $this->assertSame(100000 + $manual->uniqueCode, $manual->grandTotal);
        $this->assertSame(100000, $manual->grandTotalBeforeUniqueCode());
        $this->assertSame(100217, $manual->withUniqueCode(217)->grandTotal);

        $qris = $this->quote($items, null, null, null, 'qris_static');
        $this->assertFalse($qris->uniqueCodeRequired);
        $this->assertSame(0, $qris->uniqueCode);
        $this->assertSame(100000, $qris->grandTotal);

        $this->commerceSettings(['uniqueCodeEnabled' => false]);
        $disabled = $this->quote($items, null, null, null, 'manual_transfer');
        $this->assertSame(0, $disabled->uniqueCode);
        $this->assertSame(100000, $disabled->grandTotal);

        $calculator = app(OrderCalculator::class);
        foreach ([0, 1, 998, 999, 1000, 123456789] as $seed) {
            $this->assertGreaterThanOrEqual(1, $calculator->uniqueCodeFor($seed));
            $this->assertLessThanOrEqual(999, $calculator->uniqueCodeFor($seed));
        }
    }

    public function test_amounts_are_rounded_to_whole_rupiah(): void
    {
        $product = $this->makeProduct(['price' => 12345], 10);
        $items = [['productSlug' => $product->slug, 'qty' => 1]];

        $this->commerceSettings(['taxRate' => 11, 'priceIncludesTax' => false]);
        $exclusive = $this->quote($items);
        $this->assertSame(1358, $exclusive->taxTotal); // 1.357,95 → 1.358
        $this->assertSame(13703, $exclusive->grandTotal);

        $this->commerceSettings(['priceIncludesTax' => true]);
        $inclusive = $this->quote($items);
        $this->assertSame(1223, $inclusive->taxTotal); // 12.345 × 11 / 111 = 1.223,38 → 1.223

        foreach ($inclusive->toArray() as $key => $value) {
            if (in_array($key, ['subtotal', 'discountTotal', 'shippingTotal', 'feeTotal', 'taxTotal', 'uniqueCode', 'grandTotal'], true)) {
                $this->assertIsInt($value, $key);
            }
        }
    }

    public function test_promo_price_is_used_when_active(): void
    {
        $active = $this->makeProduct(['price' => 100000, 'promo_price' => 80000, 'promo_starts_at' => now()->subDay(), 'promo_ends_at' => now()->addDay()], 10);
        $ended = $this->makeProduct(['price' => 100000, 'promo_price' => 80000, 'promo_ends_at' => now()->subDay()], 10);

        $quote = $this->quote([['productSlug' => $active->slug, 'qty' => 1], ['productSlug' => $ended->slug, 'qty' => 1]]);

        $this->assertSame(80000, $quote->items[0]['unitPrice']);
        $this->assertTrue($quote->items[0]['promoApplied']);
        $this->assertSame(100000, $quote->items[1]['unitPrice']);
        $this->assertSame(180000, $quote->subtotal);
    }

    public function test_duplicate_items_are_merged(): void
    {
        $product = $this->makeProduct(['price' => 1000], 10);

        $quote = $this->quote([['productSlug' => $product->slug, 'qty' => 2], ['productSlug' => $product->slug, 'qty' => 3]]);

        $this->assertCount(1, $quote->items);
        $this->assertSame(5, $quote->items[0]['qty']);
        $this->assertSame(5000, $quote->subtotal);
    }

    public function test_item_validation_quote_mode_moq_and_stock(): void
    {
        $quoteOnly = $this->makeProduct(['price_mode' => Product::PRICE_MODE_QUOTE]);
        try {
            $this->quote([['productSlug' => $quoteOnly->slug, 'qty' => 1]]);
            $this->fail('expected 422');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('items.0.productSlug', $e->errors());
        }

        $moq = $this->makeProduct(['price' => 1000, 'moq' => 25], 100);
        try {
            $this->quote([['productSlug' => $moq->slug, 'qty' => 10]]);
            $this->fail('expected 422');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('items.0.qty', $e->errors());
        }

        $unpublished = $this->makeProduct(['price' => 1000, 'is_published' => false], 100);
        try {
            $this->quote([['productSlug' => $unpublished->slug, 'qty' => 1]]);
            $this->fail('expected 422');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('items.0.productSlug', $e->errors());
        }

        $scarce = $this->makeProduct(['price' => 1000], 5);
        $ok = $this->makeProduct(['price' => 1000], 5);
        try {
            $this->quote([['productSlug' => $ok->slug, 'qty' => 1], ['productSlug' => $scarce->slug, 'qty' => 6]]);
            $this->fail('expected INSUFFICIENT_STOCK');
        } catch (ApiException $e) {
            $this->assertSame(409, $e->status);
            $this->assertSame('INSUFFICIENT_STOCK', $e->errorCode);
            $this->assertSame([['productSlug' => $scarce->slug, 'requested' => 6, 'available' => 5]], $e->meta['items']);
        }
    }
}
