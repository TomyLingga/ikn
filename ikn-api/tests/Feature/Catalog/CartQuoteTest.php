<?php

namespace Tests\Feature\Catalog;

use App\Models\Product;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\CatalogFixtures;
use Tests\TestCase;

// POST /cart/quote (kontrak bagian 9): validasi item + total tanpa membuat order.
class CartQuoteTest extends TestCase
{
    use RefreshDatabase, CatalogFixtures;

    public function test_requires_customer_session(): void
    {
        $product = $this->makeProduct(['slug' => 'resiprene-35'], 10);
        $body = ['items' => [['productSlug' => $product->slug, 'qty' => 1]]];

        $this->postJson('/api/v1/cart/quote', $body)->assertStatus(401)->assertJsonPath('code', 'UNAUTHENTICATED');
        $this->actingAs($this->adminWith(['products']))->postJson('/api/v1/cart/quote', $body)->assertStatus(403);
        // Customer pending (belum disetujui) tetap boleh quote; checkout yang diblokir (ASUMSI A-12).
        $this->actingAs($this->customer(['status' => User::STATUS_PENDING]))->postJson('/api/v1/cart/quote', $body)->assertOk();
    }

    public function test_quote_returns_contract_shape_with_voucher_fee_and_unique_code(): void
    {
        $product = $this->makeProduct(['slug' => 'resiprene-35', 'code' => 'RSP-35', 'price' => 185000, 'moq' => 25, 'weight_gram' => 1000], 1200);
        $this->makeVoucher(['code' => 'IKN10', 'value' => 10, 'min_subtotal' => 5000000, 'max_discount' => 2000000]);
        $this->makeFee(5000);
        $this->makePaymentMethod('manual_transfer');
        $this->commerceSettings(['taxRate' => 11, 'priceIncludesTax' => true, 'uniqueCodeEnabled' => true]);

        $response = $this->actingAs($this->customer())->postJson('/api/v1/cart/quote', [
            'items' => [['productSlug' => 'resiprene-35', 'qty' => 100]],
            'paymentMethodCode' => 'manual_transfer',
            'voucherCode' => 'ikn10',
        ])->assertOk();

        $response->assertJsonPath('data.items.0.productSlug', 'resiprene-35')
            ->assertJsonPath('data.items.0.name.id', $product->name['id'])
            ->assertJsonPath('data.items.0.qty', 100)
            ->assertJsonPath('data.items.0.unitPrice', 185000)
            ->assertJsonPath('data.items.0.lineTotal', 18500000)
            ->assertJsonPath('data.items.0.available', 1200)
            ->assertJsonPath('data.items.0.discountAmount', 1850000)
            ->assertJsonPath('data.subtotal', 18500000)
            ->assertJsonPath('data.discountTotal', 1850000)
            ->assertJsonPath('data.voucher.code', 'IKN10')
            ->assertJsonPath('data.voucher.type', 'percent')
            ->assertJsonPath('data.shipping', null)
            ->assertJsonPath('data.availableShippingRates', [])
            ->assertJsonPath('data.fees.0.amount', 5000)
            ->assertJsonPath('data.feeTotal', 5000)
            ->assertJsonPath('data.taxRate', 11)
            ->assertJsonPath('data.priceIncludesTax', true)
            ->assertJsonPath('data.taxTotal', 1650000) // 16.650.000 × 11 / 111
            ->assertJsonPath('data.uniqueCodeRequired', true)
            ->assertJsonPath('data.warnings', []);

        $code = $response->json('data.uniqueCode');
        $this->assertGreaterThanOrEqual(1, $code);
        $this->assertLessThanOrEqual(999, $code);
        $this->assertSame(16655000 + $code, $response->json('data.grandTotal'));
        foreach (['subtotal', 'discountTotal', 'feeTotal', 'taxTotal', 'grandTotal'] as $key) {
            $this->assertIsInt($response->json("data.$key"), $key);
        }
    }

    public function test_quote_rejects_quote_product_moq_and_insufficient_stock(): void
    {
        $customer = $this->customer();
        $quoteOnly = $this->makeProduct(['slug' => 'rubber-membrane', 'price_mode' => Product::PRICE_MODE_QUOTE]);
        $moq = $this->makeProduct(['slug' => 'resiprene-35', 'moq' => 25], 100);
        $boots = $this->makeProduct(['slug' => 'sepatu-boots'], 350);

        $this->actingAs($customer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => 'rubber-membrane', 'qty' => 1]]])
            ->assertStatus(422)->assertJsonPath('code', 'VALIDATION_ERROR')->assertJsonStructure(['errors' => ['items.0.productSlug']]);

        $this->actingAs($customer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => 'resiprene-35', 'qty' => 10]]])
            ->assertStatus(422)->assertJsonStructure(['errors' => ['items.0.qty']]);

        $this->actingAs($customer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => 'sepatu-boots', 'qty' => 400]]])
            ->assertStatus(409)
            ->assertJsonPath('code', 'INSUFFICIENT_STOCK')
            ->assertJsonPath('meta.items', [['productSlug' => 'sepatu-boots', 'requested' => 400, 'available' => 350]]);

        $this->actingAs($customer)->postJson('/api/v1/cart/quote', ['items' => []])->assertStatus(422)->assertJsonStructure(['errors' => ['items']]);
        $this->actingAs($customer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => 'tidak-ada', 'qty' => 1]]])->assertStatus(422);
    }

    public function test_expired_voucher_returns_409_voucher_invalid(): void
    {
        $product = $this->makeProduct(['slug' => 'resiprene-35'], 100);
        $this->makeVoucher(['code' => 'LAMA', 'ends_at' => now()->subDay()]);
        $this->makeVoucher(['code' => 'HABIS', 'quota' => 1, 'used_count' => 1]);

        $this->actingAs($this->customer())->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]], 'voucherCode' => 'LAMA'])
            ->assertStatus(409)->assertJsonPath('code', 'VOUCHER_INVALID')->assertJsonPath('meta.reason', 'expired');

        $this->actingAs($this->customer())->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]], 'voucherCode' => 'HABIS'])
            ->assertStatus(409)->assertJsonPath('meta.reason', 'quota');
    }

    public function test_invalid_payment_method_and_shipping_rate_are_422(): void
    {
        $product = $this->makeProduct(['slug' => 'resiprene-35'], 100);
        $this->makePaymentMethod('ewallet', ['is_active' => false]);

        $this->actingAs($this->customer())->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]], 'paymentMethodCode' => 'ewallet'])
            ->assertStatus(422)->assertJsonStructure(['errors' => ['paymentMethodCode']]);

        // Tanpa alamat, shippingRateId diabaikan dengan warning (bukan error).
        $this->actingAs($this->customer())->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]], 'shippingRateId' => 99])
            ->assertOk()->assertJsonPath('data.shipping', null)->assertJsonPath('data.warnings.0', 'shipping_rate_ignored_without_address');
    }

    public function test_quote_with_address_returns_available_rates_when_address_feature_exists(): void
    {
        if (! Schema::hasTable('customer_addresses')) {
            $this->markTestSkipped('customer_addresses (area BE-1) belum ada; jalur alamat diuji di OrderCalculatorTest lewat array.');
        }

        $customer = $this->customer();
        $product = $this->makeProduct(['slug' => 'resiprene-35', 'weight_gram' => 1000], 100);
        $zone = $this->makeZone([['12', 'province']], ['base_amount' => 25000, 'per_kg_amount' => 2000]);
        $rate = $zone->rates()->first();

        // Wilayah minimal 4 level (tabel regions milik BE-1, tanpa FK parent).
        if (Schema::hasTable('regions')) {
            foreach ([['12', null, 'province', 'Sumatera Utara'], ['12.71', '12', 'regency', 'Kota Medan'], ['12.71.01', '12.71', 'district', 'Medan Kota'], ['12.71.01.1001', '12.71.01', 'village', 'Pusat Pasar']] as [$code, $parent, $level, $name]) {
                DB::table('regions')->updateOrInsert(['code' => $code], ['parent_code' => $parent, 'level' => $level, 'name' => $name]);
            }
        }
        $columns = Schema::getColumnListing('customer_addresses');
        $row = array_intersect_key([
            'user_id' => $customer->id, 'label' => 'Gudang', 'recipient_name' => 'Budi', 'phone' => '0812', 'address_line' => 'Jl. Industri',
            'province_code' => '12', 'regency_code' => '12.71', 'district_code' => '12.71.01', 'village_code' => '12.71.01.1001', 'postal_code' => '20000',
            'is_default' => true, 'created_at' => now(), 'updated_at' => now(),
        ], array_flip($columns));
        $addressId = DB::table('customer_addresses')->insertGetId($row);

        $this->actingAs($customer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 2]], 'addressId' => $addressId, 'shippingRateId' => $rate->id])
            ->assertOk()
            ->assertJsonPath('data.availableShippingRates.0.rateId', $rate->id)
            ->assertJsonPath('data.shipping.amount', 29000)
            ->assertJsonPath('data.shipping.weightGram', 2000);

        $this->actingAs($this->customer())->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 2]], 'addressId' => $addressId])
            ->assertStatus(422)->assertJsonStructure(['errors' => ['addressId']]); // alamat milik user lain
    }

    public function test_voucher_per_user_limit_counts_reserved_and_committed_usages(): void
    {
        $customer = $this->customer();
        $product = $this->makeProduct(['slug' => 'resiprene-35'], 100);
        $voucher = $this->makeVoucher(['code' => 'SEKALI', 'per_user_limit' => 1]);
        // voucher_usages.order_id ber-FK ke orders (BE-3): pakai baris order minimal, bukan id sintetis.
        $order = \App\Models\Order::forceCreate(['number' => 'IKN-00000000-00001', 'user_id' => $customer->id, 'status' => 'completed', 'customer_snapshot' => [], 'shipping_address_snapshot' => []]);
        $voucher->usages()->create(['user_id' => $customer->id, 'order_id' => $order->id, 'status' => 'committed']);

        $this->actingAs($customer)->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]], 'voucherCode' => 'SEKALI'])
            ->assertStatus(409)->assertJsonPath('meta.reason', 'per_user_limit');

        $this->actingAs($this->customer())->postJson('/api/v1/cart/quote', ['items' => [['productSlug' => $product->slug, 'qty' => 1]], 'voucherCode' => 'SEKALI'])
            ->assertOk()->assertJsonPath('data.voucher.code', 'SEKALI');
        $this->assertSame(Voucher::TYPE_PERCENT, $voucher->type);
    }
}
