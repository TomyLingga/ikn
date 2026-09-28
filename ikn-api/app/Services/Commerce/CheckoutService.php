<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Payment\PaymentService;
use App\Services\Stock\StockLedger;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Checkout (arsitektur bagian 8): dalam satu transaksi kunci produk FOR UPDATE urut id, hitung ulang lewat
 * OrderCalculator, tetapkan kode unik final, simpan order + item (snapshot), reserve stok & voucher,
 * buat payment pending, lalu transisi ∅ → pending_payment. Idempotency-Key per user berlaku 24 jam.
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
    ) {
    }

    /**
     * @param  array  $payload  items[], addressId, shippingRateId, paymentMethodCode, bankAccountId?, voucherCode?, note?
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
        $address = $this->addresses->forUser($user, (int) ($payload['addressId'] ?? 0));
        $method = $this->payments->resolveMethod($payload['paymentMethodCode'] ?? null);
        $bank = $this->payments->resolveBankAccount($method, isset($payload['bankAccountId']) ? (int) $payload['bankAccountId'] : null);

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
        );
        if ($quote->shipping === null) {
            throw \Illuminate\Validation\ValidationException::withMessages(['shippingRateId' => [__('catalog.quote.shipping_rate_invalid')]]);
        }

        // 3. Nomor order (advisory lock) lalu kode unik final yang unik di antara order pending hari ini.
        $number = $this->numbers->next();
        $quote->withUniqueCode($this->uniqueCodes->requiredFor($method) ? $this->uniqueCodes->allocate($user->id.'|'.$number) : 0);

        $user->loadMissing('profile');
        $profile = $user->profile;
        $now = now();
        $dueHours = (int) $this->settings->get('payment_due_hours');

        $order = new Order();
        $order->forceFill([
            'number' => $number,
            'user_id' => $user->id,
            'status' => Order::STATUS_PENDING_PAYMENT,
            'payment_status' => null,
            'locale' => $user->preferredLocale(),
            'customer_snapshot' => [
                'id' => $user->id,
                'name' => $profile?->company ?: $user->name,
                'company' => $profile?->company,
                'pic' => $user->name,
                'email' => $user->email,
                'phone' => $profile?->phone,
                'taxId' => $profile?->tax_id,
            ],
            'shipping_address_snapshot' => is_object($address) && method_exists($address, 'toSnapshot') ? $address->toSnapshot() : (array) $address,
            'shipping_snapshot' => $quote->shipping,
            'fees_snapshot' => $quote->fees,
            'subtotal' => $quote->subtotal,
            'discount_total' => $quote->discountTotal,
            'shipping_total' => $quote->shippingTotal,
            'fee_total' => $quote->feeTotal,
            'tax_total' => $quote->taxTotal,
            'unique_code' => $quote->uniqueCode,
            'grand_total' => $quote->grandTotal,
            'price_includes_tax' => $quote->priceIncludesTax,
            'tax_rate' => $quote->taxRate,
            'voucher_code' => $quote->voucher?->code,
            'note' => isset($payload['note']) && trim((string) $payload['note']) !== '' ? trim((string) $payload['note']) : null,
            'payment_due_at' => $now->copy()->addHours($dueHours),
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
                'unit_price' => $line['unitPrice'],
                'discount_amount' => $line['discountAmount'],
                'tax_amount' => $line['taxAmount'],
                'line_total' => $line['lineTotal'],
                'weight_gram' => $line['weightGram'],
            ]);
            $this->ledger->reserve($product, $line['qty'], $order, $user);
        }

        // 5. Kuota voucher.
        if ($quote->voucher) {
            $this->vouchers->reserve($quote->voucher, $user, $order->id);
        }

        // 6. Payment pertama (pending) + instruksi dari driver.
        $this->payments->create($order, $method, $bank, $user);

        // 7. ∅ → pending_payment (histori + email).
        $this->stateMachine->transition($order, Order::STATUS_PENDING_PAYMENT, $user);

        return $order->fresh(['items', 'payments', 'histories']);
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
