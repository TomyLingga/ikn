<?php

namespace App\Services\Commerce;

use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Voucher;

/**
 * Hasil OrderCalculator::quote() (kontrak internal BE-2 → BE-3). Semua uang integer rupiah.
 *
 * items[]: { product: Product, qty, unitPrice, basePrice, promoApplied, lineTotal, discountAmount, taxAmount, weightGram, volumeCm3 }
 * shipping: { rateId, zoneId, label{id,en}, eta{id,en}|null, amount, type, available, distanceKm, weightGram, volumeCm3, breakdown } | null
 */
final class QuoteResult
{
    /** @var array<int, array> */
    public array $items = [];

    public int $subtotal = 0;

    public int $discountTotal = 0;

    public ?Voucher $voucher = null;

    public ?array $shipping = null;

    /** @var array<int, array> tarif yang berlaku untuk alamat (kosong bila tanpa alamat) */
    public array $availableShippingRates = [];

    public int $shippingTotal = 0;

    /** @var array<int, array{id:int, name:array, type:string, amount:int}> */
    public array $fees = [];

    public int $feeTotal = 0;

    /** @var int|float persen, mis. 11 */
    public $taxRate = 0;

    public bool $priceIncludesTax = true;

    public int $taxTotal = 0;

    public ?PaymentMethod $paymentMethod = null;

    /** Kode unik wajib dibuat saat order disimpan (manual_transfer + setting aktif). */
    public bool $uniqueCodeRequired = false;

    /** Kode unik sementara (1–999) atau 0; BE-3 mengganti lewat withUniqueCode() setelah cek keunikan harian. */
    public int $uniqueCode = 0;

    public int $grandTotal = 0;

    public int $weightGram = 0;

    /** Total volume kemasan (cm³) dari dimensi produk × qty; 0 bila dimensi belum diisi (ASUMSI A-76). */
    public int $volumeCm3 = 0;

    /** @var string[] */
    public array $warnings = [];

    /** Total tanpa kode unik (dasar bagi BE-3 untuk menambahkan kode unik final). */
    public function grandTotalBeforeUniqueCode(): int
    {
        return $this->grandTotal - $this->uniqueCode;
    }

    /** Ganti kode unik (0 = tanpa kode) dan hitung ulang grandTotal. */
    public function withUniqueCode(int $code): self
    {
        $base = $this->grandTotalBeforeUniqueCode();
        $this->uniqueCode = max(0, min(999, $code));
        $this->grandTotal = $base + $this->uniqueCode;

        return $this;
    }

    /** @return int[] id kategori item (unik) */
    public function categoryIds(): array
    {
        return array_values(array_unique(array_map(fn ($item) => (int) $item['product']->category_id, $this->items)));
    }

    /** Bentuk respons POST /cart/quote (kontrak bagian 9 + availableShippingRates, fees). */
    public function toArray(): array
    {
        return [
            'items' => array_map(fn (array $item) => self::itemToArray($item), $this->items),
            'subtotal' => $this->subtotal,
            'discountTotal' => $this->discountTotal,
            'voucher' => $this->voucher ? $this->voucher->toSummary() : null,
            'shipping' => $this->shipping,
            'availableShippingRates' => $this->availableShippingRates,
            'shippingTotal' => $this->shippingTotal,
            'fees' => $this->fees,
            'feeTotal' => $this->feeTotal,
            'taxRate' => $this->taxRate,
            'priceIncludesTax' => $this->priceIncludesTax,
            'taxTotal' => $this->taxTotal,
            'paymentMethodCode' => $this->paymentMethod?->code,
            'uniqueCodeRequired' => $this->uniqueCodeRequired,
            'uniqueCode' => $this->uniqueCode,
            'grandTotal' => $this->grandTotal,
            'weightGram' => $this->weightGram,
            'volumeCm3' => $this->volumeCm3,
            'warnings' => $this->warnings,
        ];
    }

    public static function itemToArray(array $item): array
    {
        /** @var Product $product */
        $product = $item['product'];

        return [
            'productId' => $product->id,
            'productSlug' => $product->slug,
            'code' => $product->code,
            'name' => $product->name,
            'unit' => $product->unit,
            'image' => $product->primaryImageUrl(),
            'categoryId' => (int) $product->category_id,
            'qty' => $item['qty'],
            'moq' => (int) $product->moq,
            'unitPrice' => $item['unitPrice'],
            'basePrice' => $item['basePrice'],
            'promoApplied' => $item['promoApplied'],
            'lineTotal' => $item['lineTotal'],
            'discountAmount' => $item['discountAmount'],
            'taxAmount' => $item['taxAmount'],
            'isTaxable' => (bool) $product->is_taxable,
            'weightGram' => $item['weightGram'],
            'available' => $product->available,
        ];
    }
}
