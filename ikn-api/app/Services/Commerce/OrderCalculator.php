<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\Fee;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\User;
use App\Services\Commerce\Shipping\ShippingRateCalculator;
use App\Support\Money;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Satu-satunya tempat hitung harga (arsitektur bagian 9):
 * 1 harga satuan (promo bila aktif) → 2 subtotal (+ validasi moq) → 3 diskon voucher (alokasi proporsional)
 * → 4 ongkir → 5 fee aktif (umum + khusus customer) → 6 pajak (inklusif = informasi, eksklusif = ditambah; hanya item taxable)
 * → 7 kode unik (manual_transfer + setting) → 8 grand total. Semua rupiah bulat (half-up).
 */
class OrderCalculator
{
    public function __construct(
        private CommerceSettings $settings,
        private ShippingRateCalculator $shipping,
        private VoucherService $vouchers,
    ) {
    }

    /**
     * @param  array<int, array{productSlug?:string, productId?:int, qty:int}>  $items  item duplikat digabung
     * @param  object|array|null  $address  App\Models\CustomerAddress (BE-1) atau array kode wilayah
     *
     * @throws ValidationException 422 (produk tidak ada/quote/moq/rate/metode)
     * @throws ApiException 409 INSUFFICIENT_STOCK (meta.items[]) | 409 VOUCHER_INVALID (meta.reason)
     */
    public function quote(User $user, array $items, $address = null, ?int $shippingRateId = null, ?string $voucherCode = null, ?string $paymentMethodCode = null): QuoteResult
    {
        $result = new QuoteResult();
        $result->taxRate = $this->settings->get('tax_rate');
        $result->priceIncludesTax = (bool) $this->settings->get('price_includes_tax');

        // 1–2. Item, harga satuan, subtotal, validasi moq/stok.
        $requested = $this->normalizeItems($items);
        $products = $this->loadProducts($requested);
        $shortages = [];

        foreach ($requested as $line) {
            /** @var Product $product */
            $product = $products[$line['key']];
            $qty = $line['qty'];
            $index = $line['index'];

            if ($qty < (int) $product->moq) {
                throw ValidationException::withMessages(["items.$index.qty" => [__('catalog.quote.below_moq', ['product' => $product->tr('name'), 'moq' => $product->moq])]]);
            }
            if ($qty > $product->available) {
                $shortages[] = ['productSlug' => $product->slug, 'requested' => $qty, 'available' => max(0, $product->available)];
                continue;
            }

            $unitPrice = (int) $product->effectivePrice();
            $result->items[] = [
                'product' => $product,
                'qty' => $qty,
                'unitPrice' => $unitPrice,
                'basePrice' => (int) $product->priceInt(),
                'promoApplied' => $product->promoActive(),
                'lineTotal' => $unitPrice * $qty,
                'discountAmount' => 0,
                'taxAmount' => 0,
                'weightGram' => (int) $product->weight_gram * $qty,
                'volumeCm3' => $product->volumeCm3() * $qty,
            ];
        }

        if ($shortages) {
            throw ApiException::conflict('INSUFFICIENT_STOCK', __('catalog.insufficient_stock'), ['items' => $shortages]);
        }

        $result->subtotal = array_sum(array_column($result->items, 'lineTotal'));
        $result->weightGram = array_sum(array_column($result->items, 'weightGram'));
        $result->volumeCm3 = array_sum(array_column($result->items, 'volumeCm3'));

        // 3. Voucher.
        if ($voucherCode !== null && trim($voucherCode) !== '') {
            $voucher = $this->vouchers->validate($voucherCode, $user, $result->subtotal, $result->categoryIds());
            $lines = array_map(fn ($item) => ['categoryId' => (int) $item['product']->category_id, 'lineTotal' => $item['lineTotal']], $result->items);
            $discount = $this->vouchers->discountFor($voucher, $result->subtotal, $lines);

            $weights = array_map(
                fn ($item) => $this->vouchers->coversCategory($voucher, (int) $item['product']->category_id) ? $item['lineTotal'] : 0,
                $result->items
            );
            foreach (Money::allocate($discount, $weights) as $i => $share) {
                $result->items[$i]['discountAmount'] = $share;
            }

            $result->voucher = $voucher;
            $result->discountTotal = $discount;
        }

        $afterDiscount = $result->subtotal - $result->discountTotal;

        // 4. Ongkir.
        if ($address !== null) {
            // Tarif berbasis jarak tanpa titik peta (alamat atau asal) tidak ditawarkan; customer diminta menandai lokasi.
            $rates = $this->shipping->ratesFor($address, $result->weightGram, $afterDiscount, $result->volumeCm3);
            $result->availableShippingRates = array_values(array_filter($rates, fn ($rate) => $rate['available'] ?? true));
            if (count($result->availableShippingRates) < count($rates)) {
                $originSet = $this->settings->get('shipping_origin_lat') !== null && $this->settings->get('shipping_origin_lng') !== null;
                $result->warnings[] = $originSet ? 'distance_unavailable' : 'shipping_origin_unset';
            }
            if ($result->availableShippingRates === []) {
                $result->warnings[] = 'no_shipping_rate';
            }
            if ($shippingRateId !== null) {
                $selected = null;
                foreach ($result->availableShippingRates as $rate) {
                    if ($rate['rateId'] === $shippingRateId) {
                        $selected = $rate;
                        break;
                    }
                }
                if (! $selected) {
                    throw ValidationException::withMessages(['shippingRateId' => [__('catalog.quote.shipping_rate_invalid')]]);
                }
                $result->shipping = $selected + ['weightGram' => $result->weightGram, 'volumeCm3' => $result->volumeCm3];
                $result->shippingTotal = $selected['amount'];
            }
        } elseif ($shippingRateId !== null) {
            $result->warnings[] = 'shipping_rate_ignored_without_address';
        }

        // 5. Fee aktif: yang berlaku untuk semua customer + yang ditujukan khusus ke customer ini (ASUMSI A-67).
        foreach (Fee::active()->forCustomer($user)->orderBy('sort_order')->orderBy('id')->get() as $fee) {
            $result->fees[] = ['id' => $fee->id, 'name' => $fee->name, 'type' => $fee->type, 'amount' => $fee->amountInt()];
        }
        $result->feeTotal = array_sum(array_column($result->fees, 'amount'));

        // 6. Pajak: hanya item taxable, dasar = line − diskon; dialokasikan proporsional agar Σ item = total.
        $rate = (float) $result->taxRate;
        $taxableBases = array_map(
            fn ($item) => $item['product']->is_taxable ? $item['lineTotal'] - $item['discountAmount'] : 0,
            $result->items
        );
        $taxableBase = array_sum($taxableBases);
        $result->taxTotal = $rate > 0 && $taxableBase > 0
            ? ($result->priceIncludesTax
                ? Money::round($taxableBase * $rate / (100 + $rate))
                : Money::round($taxableBase * $rate / 100))
            : 0;
        foreach (Money::allocate($result->taxTotal, $taxableBases) as $i => $share) {
            $result->items[$i]['taxAmount'] = $share;
        }

        // 7. Metode bayar + kode unik (ASUMSI A-9: hanya transfer manual bila setting aktif).
        if ($paymentMethodCode !== null && trim($paymentMethodCode) !== '') {
            $method = PaymentMethod::active()->where('code', strtolower(trim($paymentMethodCode)))->first();
            if (! $method) {
                throw ValidationException::withMessages(['paymentMethodCode' => [__('catalog.quote.payment_method_invalid')]]);
            }
            $result->paymentMethod = $method;
            $result->uniqueCodeRequired = $method->isManualTransfer() && (bool) $this->settings->get('unique_code_enabled');
        }

        // 8. Grand total.
        $result->grandTotal = $afterDiscount
            + $result->shippingTotal
            + $result->feeTotal
            + ($result->priceIncludesTax ? 0 : $result->taxTotal);

        if ($result->uniqueCodeRequired) {
            $result->withUniqueCode($this->uniqueCodeFor(crc32($user->id.'|'.now()->format('YmdHi'))));
        }

        return $result;
    }

    /** Kode unik 1–999 dari seed (BE-3 menaikkan seed sampai unik di antara order pending hari itu). */
    public function uniqueCodeFor(int $seed): int
    {
        return (abs($seed) % 999) + 1;
    }

    /**
     * Gabungkan item duplikat (slug/id sama) dan validasi bentuk dasar.
     *
     * @return array<int, array{key:string, qty:int, index:int}>
     */
    public function normalizeItems(array $items): array
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => [__('catalog.quote.items_required')]]);
        }

        $merged = [];
        foreach (array_values($items) as $index => $item) {
            $slug = isset($item['productSlug']) ? trim((string) $item['productSlug']) : '';
            $id = isset($item['productId']) ? (int) $item['productId'] : 0;
            $key = $slug !== '' ? 'slug:'.$slug : ($id > 0 ? 'id:'.$id : '');
            if ($key === '') {
                throw ValidationException::withMessages(["items.$index.productSlug" => [__('catalog.quote.product_not_found')]]);
            }
            $qty = (int) ($item['qty'] ?? 0);
            if ($qty < 1) {
                throw ValidationException::withMessages(["items.$index.qty" => [__('catalog.quote.qty_min')]]);
            }
            if (isset($merged[$key])) {
                $merged[$key]['qty'] += $qty;
            } else {
                $merged[$key] = ['key' => $key, 'qty' => $qty, 'index' => $index];
            }
        }

        return array_values($merged);
    }

    /**
     * Muat produk published + kategori + gambar; tolak yang tidak ada atau price_mode=quote (ASUMSI A-10).
     *
     * @return Collection<string, Product> key → product
     */
    private function loadProducts(array $requested): Collection
    {
        $slugs = [];
        $ids = [];
        foreach ($requested as $line) {
            [$kind, $value] = explode(':', $line['key'], 2);
            if ($kind === 'slug') {
                $slugs[] = $value;
            } else {
                $ids[] = (int) $value;
            }
        }

        $products = Product::published()->with(['category', 'images.media'])
            ->where(function ($q) use ($slugs, $ids) {
                $q->whereIn('slug', $slugs ?: ['-'])->orWhereIn('id', $ids ?: [0]);
            })->get();

        $map = collect();
        foreach ($requested as $line) {
            [$kind, $value] = explode(':', $line['key'], 2);
            $product = $products->first(fn (Product $p) => $kind === 'slug' ? $p->slug === $value : $p->id === (int) $value);
            if (! $product) {
                throw ValidationException::withMessages(["items.{$line['index']}.productSlug" => [__('catalog.quote.product_not_found')]]);
            }
            if (! $product->isFixedPrice()) {
                throw ValidationException::withMessages(["items.{$line['index']}.productSlug" => [__('catalog.quote.product_quote_only', ['product' => $product->tr('name')])]]);
            }
            $map[$line['key']] = $product;
        }

        return $map;
    }
}
