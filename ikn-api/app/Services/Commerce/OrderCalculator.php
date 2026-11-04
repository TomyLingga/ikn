<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\DeliveryTerm;
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
 * 0 mata uang dari pasar customer (export = USD, ASUMSI A-86) → 1 harga satuan (IDR: promo bila aktif; USD: price_usd)
 * → 2 subtotal (+ validasi moq) → 3 diskon voucher (hanya IDR; alokasi proporsional)
 * → 4 ongkir (tarif zona hanya untuk term `zone`, dihitung per pabrik asal lalu dijumlah, ASUMSI A-90; Loco/FOB = baris
 * sintetis 0, ASUMSI A-85; Loco + titik ambil per pabrik)
 * → 5 fee aktif se-mata-uang (umum + khusus customer) → 6 pajak mengikuti term (domestic = tax_rate, export = export_tax_rate;
 * inklusif = informasi, eksklusif = ditambah; hanya item taxable) → 7 kode unik (manual_transfer + setting, hanya IDR)
 * → 8 grand total. Semua integer satuan terkecil mata uang (half-up).
 */
class OrderCalculator
{
    public function __construct(
        private CommerceSettings $settings,
        private ShippingRateCalculator $shipping,
        private VoucherService $vouchers,
        private FactoryLocations $factories,
    ) {
    }

    /**
     * @param  array<int, array{productSlug?:string, productId?:int, qty:int}>  $items  item duplikat digabung
     * @param  object|array|null  $address  App\Models\CustomerAddress (BE-1) atau array kode wilayah
     * @param  DeliveryTerm|null  $term  cara serah terima; null = jalur tarif zona lama (pemanggil tanpa term)
     * @param  array|null  $destinationPort  { name, country, countryCode, lat, lng } untuk term CIF (ASUMSI A-89); hanya disalin ke baris shipping
     *
     * @throws ValidationException 422 (produk tidak ada/quote/tanpa harga USD/moq/rate/metode)
     * @throws ApiException 409 INSUFFICIENT_STOCK (meta.items[]) | 409 VOUCHER_INVALID (meta.reason)
     */
    public function quote(User $user, array $items, $address = null, ?int $shippingRateId = null, ?string $voucherCode = null, ?string $paymentMethodCode = null, ?DeliveryTerm $term = null, ?array $destinationPort = null): QuoteResult
    {
        $currency = $user->currency();

        $result = new QuoteResult();
        $result->currency = $currency;
        $result->deliveryTerm = $term;
        $result->taxRate = $this->settings->get($term !== null && $term->isExportTax() ? 'export_tax_rate' : 'tax_rate');
        $result->priceIncludesTax = (bool) $this->settings->get('price_includes_tax');

        // 1–2. Item, harga satuan, subtotal, validasi moq/stok.
        $requested = $this->normalizeItems($items);
        $products = $this->loadProducts($requested, $currency);
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

            $isUsd = Money::isUsd($currency);
            $unitPrice = (int) $product->effectivePriceMinor($currency);
            $result->items[] = [
                'product' => $product,
                'qty' => $qty,
                'unitPrice' => $unitPrice,
                'basePrice' => $isUsd ? (int) $product->priceUsdMinor() : (int) $product->priceInt(),
                'promoApplied' => $isUsd ? false : $product->promoActive(),
                'lineTotal' => $unitPrice * $qty,
                'discountAmount' => 0,
                'taxAmount' => 0,
                'weightGram' => (int) $product->weight_gram * $qty,
                'volumeCm3' => $product->volumeCm3() * $qty,
                // Pabrik asal (ASUMSI A-90): null di produk = pabrik bawaan; menentukan parcel ongkir dan titik ambil Loco.
                'factory' => $this->factories->forProduct($product),
            ];
        }

        if ($shortages) {
            throw ApiException::conflict('INSUFFICIENT_STOCK', __('catalog.insufficient_stock'), ['items' => $shortages]);
        }

        $result->subtotal = array_sum(array_column($result->items, 'lineTotal'));
        $result->weightGram = array_sum(array_column($result->items, 'weightGram'));
        $result->volumeCm3 = array_sum(array_column($result->items, 'volumeCm3'));

        // 3. Voucher (hanya order IDR; USD → 409 VOUCHER_INVALID reason currency).
        if ($voucherCode !== null && trim($voucherCode) !== '') {
            $voucher = $this->vouchers->validate($voucherCode, $user, $result->subtotal, $result->categoryIds(), $currency);
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

        // 4. Ongkir. Term tanpa tarif zona (Loco, FOB, CIF) tidak memakai alamat maupun zona: baris sintetis 0.
        //    CIF (pricing_mode quoted, ASUMSI A-89): ongkir ditawarkan admin setelah order dibuat, jadi quote memberi warning
        //    freight_quote_pending dan grand total bersifat sementara (tanpa ongkir).
        if ($term !== null && ! $term->usesZone()) {
            $quoted = $term->pricing_mode === DeliveryTerm::PRICING_QUOTED;
            $result->shipping = [
                'rateId' => null,
                'zoneId' => null,
                'type' => $quoted ? 'quoted' : ($term->isPickup() ? 'pickup' : 'included'),
                'label' => $term->name,
                'eta' => null,
                'amount' => 0,
                'available' => true,
                'breakdown' => null,
                'weightGram' => $result->weightGram,
                'volumeCm3' => $result->volumeCm3,
            ];
            if ($quoted) {
                $result->shipping['destinationPort'] = $destinationPort;
                $result->warnings[] = 'freight_quote_pending';
            }
            if ($term->isPickup()) {
                // Loco (ASUMSI A-90): satu titik ambil per pabrik asal item; pabrik yang tidak melayani ambil → 422.
                $result->pickupPoints = $this->pickupPoints($result->items, $user->preferredLocale());
            }
            $result->shippingTotal = 0;
        } elseif ($address !== null) {
            // Tarif zona hanya untuk pasar lokal (rupiah). Customer ekspor tidak punya term zona (resolver menyaring pasar).
            // Keranjang dipecah per pabrik asal (ASUMSI A-90); tarif berbasis jarak tanpa titik peta (alamat atau pabrik)
            // tidak ditawarkan; customer diminta menandai lokasi, admin diminta mengisi koordinat pabrik.
            $rates = $this->shipping->ratesFor($address, $this->parcels($result->items), $afterDiscount);
            $result->availableShippingRates = [];
            $addressPointMissing = false;
            $factoriesUnset = [];
            foreach ($rates as $rate) {
                if ($rate['available'] ?? true) {
                    unset($rate['unavailable']);
                    $result->availableShippingRates[] = $rate;
                    continue;
                }
                $reason = $rate['unavailable'] ?? [];
                $addressPointMissing = $addressPointMissing || ! ($reason['addressPoint'] ?? false);
                $factoriesUnset = array_merge($factoriesUnset, $reason['factoryCodes'] ?? []);
            }
            if ($addressPointMissing) {
                $result->warnings[] = 'distance_unavailable';
            }
            if ($factoriesUnset !== []) {
                $result->warnings[] = 'factory_location_unset';
                $result->warningMeta['factory_location_unset'] = [
                    'factoryCodes' => array_values(array_unique(array_filter($factoriesUnset, fn ($code) => $code !== null))),
                ];
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

        // 5. Fee aktif se-mata-uang: untuk semua customer + yang ditujukan khusus ke customer ini (ASUMSI A-67, A-86).
        foreach (Fee::active()->forCurrency($currency)->forCustomer($user)->orderBy('sort_order')->orderBy('id')->get() as $fee) {
            $result->fees[] = ['id' => $fee->id, 'name' => $fee->name, 'type' => $fee->type, 'amount' => $fee->amountInt(), 'currency' => $fee->currencyCode()];
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

        // 7. Metode bayar + kode unik (ASUMSI A-9: hanya transfer manual bila setting aktif; A-86: hanya order IDR).
        if ($paymentMethodCode !== null && trim($paymentMethodCode) !== '') {
            $method = PaymentMethod::active()->where('code', strtolower(trim($paymentMethodCode)))->first();
            if (! $method) {
                throw ValidationException::withMessages(['paymentMethodCode' => [__('catalog.quote.payment_method_invalid')]]);
            }
            if (! Money::isIdr($currency) && ! $method->isManualTransfer()) {
                // Order USD hanya transfer manual ke rekening USD; QRIS dan gateway tidak tersedia.
                throw ValidationException::withMessages(['paymentMethodCode' => [__('catalog.quote.payment_method_currency', ['currency' => $currency])]]);
            }
            $result->paymentMethod = $method;
            // Term quoted (CIF): kode unik baru dialokasikan saat penawaran ongkir diterima (FreightQuoteService::accept).
            $termQuoted = $term !== null && $term->pricing_mode === DeliveryTerm::PRICING_QUOTED;
            $result->uniqueCodeRequired = ! $termQuoted && Money::isIdr($currency) && $method->isManualTransfer() && (bool) $this->settings->get('unique_code_enabled');
        }

        // 8. Grand total.
        $result->grandTotal = self::grandTotalOf($result->subtotal, $result->discountTotal, $result->shippingTotal, $result->feeTotal, $result->taxTotal, $result->priceIncludesTax);

        if ($result->uniqueCodeRequired) {
            $result->withUniqueCode($this->uniqueCodeFor(crc32($user->id.'|'.now()->format('YmdHi'))));
        }

        return $result;
    }

    /**
     * Aritmetika grand total yang sama untuk quote, checkout, dan penghitungan ulang saat ongkir CIF disetujui
     * (FreightQuoteService): subtotal − diskon + ongkir + fee + (pajak bila eksklusif) + kode unik. Semua satuan terkecil.
     */
    public static function grandTotalOf(int $subtotal, int $discountTotal, int $shippingTotal, int $feeTotal, int $taxTotal, bool $priceIncludesTax, int $uniqueCode = 0): int
    {
        return $subtotal - $discountTotal + $shippingTotal + $feeTotal + ($priceIncludesTax ? 0 : $taxTotal) + max(0, $uniqueCode);
    }

    /**
     * Item dikelompokkan per pabrik asal (ASUMSI A-90), urut sesuai daftar pabrik: satu parcel = satu kiriman dari satu pabrik.
     *
     * @return array<int, array{factory: ?\App\Models\FactoryLocation, weightGram: int, volumeCm3: int, items: string[]}>
     */
    private function parcels(array $items): array
    {
        $groups = [];
        foreach ($items as $item) {
            $factory = $item['factory'] ?? null;
            $key = $factory ? (int) $factory->id : 0;
            $groups[$key] ??= ['factory' => $factory, 'weightGram' => 0, 'volumeCm3' => 0, 'items' => [], 'sort' => $factory ? [(int) $factory->sort_order, (int) $factory->id] : [PHP_INT_MAX, 0]];
            $groups[$key]['weightGram'] += (int) $item['weightGram'];
            $groups[$key]['volumeCm3'] += (int) $item['volumeCm3'];
            $groups[$key]['items'][] = $item['product']->slug;
        }
        uasort($groups, fn ($a, $b) => $a['sort'] <=> $b['sort']);

        return array_values(array_map(function ($group) {
            unset($group['sort']);

            return $group;
        }, $groups));
    }

    /**
     * Titik ambil Loco = pabrik asal item yang melayani ambil (ASUMSI A-90), urut daftar pabrik:
     * { code, name {id,en}, label (bahasa customer), address, lat, lng, items: productSlug[] }.
     *
     * @throws ValidationException 422 deliveryTermCode bila ada item dari pabrik yang tidak melayani ambil (atau tanpa pabrik)
     */
    private function pickupPoints(array $items, string $locale): array
    {
        $points = [];
        foreach ($this->parcels($items) as $parcel) {
            /** @var \App\Models\FactoryLocation|null $factory */
            $factory = $parcel['factory'];
            if (! $factory || ! $factory->allows_pickup) {
                throw ValidationException::withMessages(['deliveryTermCode' => [$factory
                    ? __('catalog.quote.pickup_not_allowed', ['factory' => $factory->tr('name')])
                    : __('catalog.quote.pickup_unavailable')]]);
            }
            $points[] = [
                'code' => $factory->code,
                'name' => $factory->name,
                'label' => $factory->tr('name', $locale),
                'address' => $factory->address,
                'lat' => $factory->latitude(),
                'lng' => $factory->longitude(),
                'items' => $parcel['items'],
            ];
        }

        return $points;
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
     * Muat produk published + kategori + gambar; tolak yang tidak ada, price_mode=quote (ASUMSI A-10), atau tanpa
     * harga dalam mata uang order (produk tanpa price_usd tidak bisa dipesan customer ekspor, ASUMSI A-86).
     *
     * @return Collection<string, Product> key → product
     */
    private function loadProducts(array $requested, string $currency): Collection
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
            if ($product->effectivePriceMinor($currency) === null) {
                throw ValidationException::withMessages(["items.{$line['index']}.productSlug" => [__('catalog.quote.product_no_price_currency', ['product' => $product->tr('name'), 'currency' => $currency])]]);
            }
            $map[$line['key']] = $product;
        }

        return $map;
    }
}
