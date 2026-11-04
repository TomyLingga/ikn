<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\DeliveryTerm;
use App\Models\Order;
use App\Models\PaymentTerm;
use App\Models\Product;
use App\Models\User;
use App\Services\Payment\PaymentService;
use App\Services\Stock\StockLedger;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Checkout (arsitektur bagian 8): dalam satu transaksi kunci produk FOR UPDATE urut id, hitung ulang lewat
 * OrderCalculator, tetapkan kode unik final, simpan order + item (snapshot), reserve stok & voucher,
 * buat payment pending, lalu transisi ∅ → pending_payment. Idempotency-Key per user berlaku 24 jam.
 * Mata uang order mengikuti pasar customer (ASUMSI A-86); angka ditulis ke DB lewat Money::fromMinor.
 * Term CIF (pricing_mode quoted, ASUMSI A-89): order dibuat awaiting_freight tanpa payment, kode unik, dan batas bayar;
 * metode bayar disimpan di pending_payment_method dan dipakai FreightQuoteService saat penawaran ongkir diterima.
 */
class CheckoutService
{
    public const IDEMPOTENCY_HOURS = 24;

    private bool $lastWasReplay = false;

    public function __construct(
        private OrderCalculator $calculator,
        private AddressResolver $addresses,
        private OrderNumberGenerator $numbers,
        private UniqueCodeAllocator $uniqueCodes,
        private CommerceSettings $settings,
        private StockLedger $ledger,
        private VoucherService $vouchers,
        private PaymentService $payments,
        private OrderStateMachine $stateMachine,
        private DeliveryTermResolver $terms,
        private PaymentTermResolver $paymentTerms,
    ) {
    }

    /**
     * @param  array  $payload  items[], deliveryTermCode?, paymentTermCode?, addressId?, shippingRateId?, paymentMethodCode, bankAccountId?, voucherCode?, note?, destinationPort?
     *                          (alamat + tarif wajib hanya untuk term bertarif zona, ASUMSI A-85; paymentTermCode wajib untuk customer ekspor, A-87;
     *                          destinationPort {name, country, countryCode, lat, lng} wajib untuk term CIF, A-89)
     *
     * @throws \Illuminate\Validation\ValidationException 422
     * @throws ApiException 409 INSUFFICIENT_STOCK | VOUCHER_INVALID
     */
    public function place(User $user, array $payload, ?string $idempotencyKey = null): Order
    {
        $this->lastWasReplay = false;
        $key = $this->normalizeKey($idempotencyKey);

        if ($key !== null && ($existing = $this->replay($user, $key))) {
            $this->lastWasReplay = true;

            return $existing;
        }

        try {
            return DB::transaction(fn () => $this->createOrder($user, $payload, $key));
        } catch (QueryException $e) {
            // Dua request dengan Idempotency-Key sama nyaris bersamaan: yang kalah mengembalikan order pemenang.
            if ($key !== null && (string) $e->getCode() === '23505' && ($existing = $this->replay($user, $key))) {
                $this->lastWasReplay = true;

                return $existing;
            }
            throw $e;
        }
    }

    /** true bila panggilan place() terakhir mengembalikan order lama (Idempotency-Key sama) → HTTP 200, bukan 201. */
    public function lastWasReplay(): bool
    {
        return $this->lastWasReplay;
    }

    private function createOrder(User $user, array $payload, ?string $key): Order
    {
        $items = $payload['items'] ?? [];
        // Kunci baris user lebih dulu (sebelum produk) lalu baca pasar terkini: admin yang mengganti pasar
        // (CustomerMarketService::change) menunggu kunci yang sama, jadi mata uang order tidak basi.
        User::whereKey($user->id)->lockForUpdate()->first();
        $user->load('profile');
        $market = $user->market();
        $currency = $user->currency();

        // Term dan syarat bayar mengikuti pasar customer (customer ekspor tidak bisa memilih term lokal, dan sebaliknya).
        $term = $this->terms->resolve($payload['deliveryTermCode'] ?? null, $market);
        $paymentTerm = $this->paymentTerms->resolve($payload['paymentTermCode'] ?? null, $user, true);
        // Loco/FOB tidak butuh alamat; bila customer tetap memilihnya, alamat hanya dicek kepemilikannya.
        $address = $term->usesZone() || ! empty($payload['addressId'])
            ? $this->addresses->forUser($user, (int) ($payload['addressId'] ?? 0))
            : null;
        // Order USD hanya transfer manual ke rekening USD (ASUMSI A-86).
        $method = $this->payments->resolveMethod($payload['paymentMethodCode'] ?? null, $currency);
        $bank = $this->payments->resolveBankAccount($method, isset($payload['bankAccountId']) ? (int) $payload['bankAccountId'] : null, $currency);
        // CIF (ASUMSI A-89): ongkir ditawarkan admin setelah order dibuat; pelabuhan tujuan wajib.
        $quoted = $term->pricing_mode === DeliveryTerm::PRICING_QUOTED;
        $port = $this->destinationPort($term, $payload['destinationPort'] ?? null);

        // 1. Kunci baris produk urut id (tidak deadlock antar checkout paralel); calculator membaca nilai terkini.
        $this->lockProducts($items);

        // 2. Validasi ulang harga/stok/ongkir/voucher/pajak (INSUFFICIENT_STOCK dan VOUCHER_INVALID dari sini).
        $quote = $this->calculator->quote(
            $user,
            $items,
            $address,
            isset($payload['shippingRateId']) ? (int) $payload['shippingRateId'] : null,
            $payload['voucherCode'] ?? null,
            $method->code,
            $term,
            $port,
        );
        $quote->paymentTerm = $paymentTerm;
        // Term zona tanpa tarif terpilih; term tanpa ongkir selalu punya baris sintetis dari calculator.
        if ($quote->shipping === null) {
            throw \Illuminate\Validation\ValidationException::withMessages(['shippingRateId' => [__('catalog.quote.shipping_rate_invalid')]]);
        }

        // 3. Nomor order (advisory lock) lalu kode unik final yang unik di antara order pending hari ini (hanya IDR;
        //    order CIF tanpa kode unik sampai penawaran diterima: kode unik tidak dipakai order USD).
        $number = $this->numbers->next();
        $quote->withUniqueCode(! $quoted && $this->uniqueCodes->requiredFor($method, $currency) ? $this->uniqueCodes->allocate($user->id.'|'.$number) : 0);

        $user->loadMissing('profile');
        $profile = $user->profile;
        $now = now();
        $dueHours = (int) $this->settings->get(Money::isUsd($currency) ? 'export_payment_due_hours' : 'payment_due_hours');
        $money = fn (int $minor) => Money::fromMinor($minor, $currency);

        $order = new Order();
        $order->forceFill([
            'number' => $number,
            'user_id' => $user->id,
            'status' => $quoted ? Order::STATUS_AWAITING_FREIGHT : Order::STATUS_PENDING_PAYMENT,
            'payment_status' => null,
            'locale' => $user->preferredLocale(),
            'currency' => $currency,
            'customer_snapshot' => [
                'id' => $user->id,
                'name' => $profile?->company ?: $user->name,
                'company' => $profile?->company,
                'pic' => $user->name,
                'email' => $user->email,
                'phone' => $profile?->phone,
                'taxId' => $profile?->tax_id,
                'market' => $market,
                'countryCode' => $profile?->country_code,
                'companyAddress' => $profile?->company_address,
            ],
            'shipping_address_snapshot' => $this->addressSnapshot($term, $address, $user, $port, $quote->pickupPoints),
            'shipping_snapshot' => $quote->shipping + ['term' => $term->code, 'family' => $term->family, 'pricingMode' => $term->pricing_mode],
            'destination_port' => $port,
            'pending_payment_method' => $quoted ? ['code' => $method->code, 'bankAccountId' => $bank?->id] : null,
            'delivery_term' => $term->code,
            'payment_term_code' => $paymentTerm?->code,
            'payment_term_snapshot' => $paymentTerm?->toSnapshot(),
            'fees_snapshot' => $quote->fees,
            'subtotal' => $money($quote->subtotal),
            'discount_total' => $money($quote->discountTotal),
            'shipping_total' => $money($quote->shippingTotal),
            'fee_total' => $money($quote->feeTotal),
            'tax_total' => $money($quote->taxTotal),
            'unique_code' => $quote->uniqueCode,
            'grand_total' => $money($quote->grandTotal),
            'price_includes_tax' => $quote->priceIncludesTax,
            'tax_rate' => $quote->taxRate,
            'voucher_code' => $quote->voucher?->code,
            'note' => isset($payload['note']) && trim((string) $payload['note']) !== '' ? trim((string) $payload['note']) : null,
            'payment_due_at' => $quoted ? null : $now->copy()->addHours($dueHours),
            'idempotency_key' => $key,
        ])->save();

        // 4. Item (snapshot produk) + reserve stok per item.
        foreach ($quote->items as $line) {
            /** @var Product $product */
            $product = $line['product'];
            $order->items()->create([
                'product_id' => $product->id,
                'product_snapshot' => [
                    'id' => $product->id,
                    'slug' => $product->slug,
                    'code' => $product->code,
                    'name' => $product->name,
                    'unit' => $product->unit,
                    'image' => $product->primaryImageUrl(),
                    'categoryId' => (int) $product->category_id,
                ],
                'qty' => $line['qty'],
                'currency' => $currency,
                'unit_price' => $money($line['unitPrice']),
                'discount_amount' => $money($line['discountAmount']),
                'tax_amount' => $money($line['taxAmount']),
                'line_total' => $money($line['lineTotal']),
                'weight_gram' => $line['weightGram'],
            ]);
            $this->ledger->reserve($product, $line['qty'], $order, $user);
        }

        // 5. Kuota voucher.
        if ($quote->voucher) {
            $this->vouchers->reserve($quote->voucher, $user, $order->id);
        }

        if ($quoted) {
            // 6-7. CIF: belum ada payment; ∅ → awaiting_freight (histori + email "menunggu penawaran ongkir").
            $this->stateMachine->transition($order, Order::STATUS_AWAITING_FREIGHT, $user);

            return $order->fresh(['items', 'payments', 'histories']);
        }

        // 6. Payment pertama (pending) + instruksi dari driver.
        $this->payments->create($order, $method, $bank, $user);

        // 7. ∅ → pending_payment (histori + email).
        $this->stateMachine->transition($order, Order::STATUS_PENDING_PAYMENT, $user);

        return $order->fresh(['items', 'payments', 'histories']);
    }

    /**
     * Pelabuhan tujuan (ASUMSI A-89) untuk term yang mewajibkannya: { name, country, countryCode, lat, lng } dibulatkan
     * 6 desimal; term lain mengabaikan input. Form Request sudah mewajibkan field-nya; pemeriksaan di sini untuk pemanggil
     * internal (seeder, test) agar order CIF tidak pernah tanpa pelabuhan tujuan.
     */
    private function destinationPort(DeliveryTerm $term, $input): ?array
    {
        if (! $term->requires_destination_port) {
            return null;
        }
        $input = is_array($input) ? $input : [];
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '' || ! isset($input['lat'], $input['lng']) || ! is_numeric($input['lat']) || ! is_numeric($input['lng'])) {
            throw \Illuminate\Validation\ValidationException::withMessages(['destinationPort' => [__('commerce.destination_port_required')]]);
        }
        $code = strtoupper(trim((string) ($input['countryCode'] ?? '')));

        return [
            'name' => mb_substr($name, 0, 120),
            'country' => trim((string) ($input['country'] ?? '')) !== '' ? mb_substr(trim((string) $input['country']), 0, 80) : null,
            'countryCode' => preg_match('/^[A-Z]{2}$/', $code) ? $code : null,
            'lat' => round((float) $input['lat'], 6),
            'lng' => round((float) $input['lng'], 6),
        ];
    }

    /**
     * Snapshot alamat (kolom NOT NULL, tidak pernah []): alamat customer untuk term diantar; Loco = titik ambil per pabrik
     * asal item (type "pickup", ASUMSI A-90: `points[]` + label/address/lat/lng titik pertama untuk pembaca lama);
     * FOB/CIF = pelabuhan muat + identitas perusahaan pembeli (type "port", ASUMSI A-86) agar invoice dan email tetap punya
     * tempat serah terima walau pabrik/term diubah; CIF menambah pelabuhan tujuan (A-89).
     *
     * @param  object|array|null  $address
     * @param  array<int, array>  $pickupPoints  dari QuoteResult::$pickupPoints
     */
    private function addressSnapshot(DeliveryTerm $term, $address, User $user, ?array $port = null, array $pickupPoints = []): array
    {
        $profile = $user->profile;

        if ($term->isPickup()) {
            $first = $pickupPoints[0] ?? [];

            return [
                'type' => 'pickup',
                'points' => $pickupPoints,
                'label' => $first['label'] ?? null,
                'address' => $first['address'] ?? null,
                'lat' => $first['lat'] ?? null,
                'lng' => $first['lng'] ?? null,
                'recipientName' => $profile?->company ?: $user->name,
                'phone' => $profile?->phone,
            ];
        }
        if ($term->isPort()) {
            return [
                'type' => 'port',
                'label' => $term->name,
                'loadingPort' => $term->loading_port,
                'destinationPort' => $port,
                'companyName' => $profile?->company ?: $user->name,
                'companyAddress' => $profile?->company_address,
                'countryCode' => $profile?->country_code,
                'recipientName' => $user->name,
                'phone' => $profile?->phone,
            ];
        }
        if ($address === null) {
            return ['type' => 'none'];
        }

        return is_object($address) && method_exists($address, 'toSnapshot') ? $address->toSnapshot() : (array) $address;
    }

    /** SELECT ... FOR UPDATE pada produk yang diminta, urut id. Produk yang tidak ada dibiarkan (calculator yang menolak). */
    private function lockProducts(array $items): void
    {
        $slugs = [];
        $ids = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            if (isset($item['productSlug']) && trim((string) $item['productSlug']) !== '') {
                $slugs[] = trim((string) $item['productSlug']);
            } elseif (isset($item['productId']) && (int) $item['productId'] > 0) {
                $ids[] = (int) $item['productId'];
            }
        }
        if ($slugs === [] && $ids === []) {
            return;
        }

        Product::query()
            ->where(fn ($q) => $q->whereIn('slug', $slugs ?: ['-'])->orWhereIn('id', $ids ?: [0]))
            ->orderBy('id')
            ->lockForUpdate()
            ->get(['id']);
    }

    private function replay(User $user, string $key): ?Order
    {
        $existing = Order::where('user_id', $user->id)->where('idempotency_key', $key)->first();
        if (! $existing) {
            return null;
        }
        if ($existing->created_at && $existing->created_at->gt(now()->subHours(self::IDEMPOTENCY_HOURS))) {
            return $existing->load(['items', 'payments', 'histories']);
        }

        // Kunci lama (> 24 jam) dilepas agar order baru bisa memakai kunci yang sama.
        $existing->forceFill(['idempotency_key' => null])->save();

        return null;
    }

    private function normalizeKey(?string $key): ?string
    {
        $key = trim((string) $key);

        return $key === '' ? null : mb_substr($key, 0, 80);
    }
}
