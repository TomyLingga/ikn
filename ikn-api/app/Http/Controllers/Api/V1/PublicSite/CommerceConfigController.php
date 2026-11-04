<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\FeeResource;
use App\Models\BankAccount;
use App\Models\CustomerProfile;
use App\Models\DeliveryTerm;
use App\Models\FactoryLocation;
use App\Models\Fee;
use App\Models\PaymentMethod;
use App\Models\PaymentTerm;
use App\Models\User;
use App\Services\Commerce\CommerceSettings;
use App\Services\Commerce\FactoryLocations;

/**
 * GET /commerce/config dan GET /payment-methods (kontrak bagian 9 dan 10): hanya data aktif, tanpa config rahasia.
 * Bagian yang bergantung pasar (ASUMSI A-86) mengikuti pengunjung: customer ekspor yang login melihat term/syarat
 * bayar/fee pasar ekspor dan `currency` USD; tamu, admin, dan customer lokal melihat pasar lokal (IDR).
 */
class CommerceConfigController extends ApiController
{
    public function config(CommerceSettings $settings, FactoryLocations $factories)
    {
        $api = $settings->toApi();
        $viewer = auth('sanctum')->user();
        $market = $viewer instanceof User ? $viewer->market() : CustomerProfile::MARKET_LOCAL;
        $currency = CustomerProfile::currencyFor($market);

        return $this->data([
            'market' => $market,
            'currency' => $currency,
            'paymentMethods' => $this->activeMethods(),
            // Semua rekening aktif beserta mata uangnya; FE menyaring sesuai `currency` (order USD hanya rekening USD).
            'bankAccounts' => BankAccount::active()->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (BankAccount $account) => $account->toSummary() + ['isActive' => true])->values()->all(),
            // Hanya biaya untuk semua customer se-mata-uang; biaya khusus customer muncul di POST /cart/quote miliknya.
            'fees' => Fee::active()->forCurrency($currency)->forEveryone()->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (Fee $fee) => FeeResource::publicArray($fee))->values()->all(),
            'paymentDueHours' => $api['paymentDueHours'],
            'exportPaymentDueHours' => $api['exportPaymentDueHours'],
            'taxRate' => $api['taxRate'],
            'exportTaxRate' => $api['exportTaxRate'],
            'priceIncludesTax' => $api['priceIncludesTax'],
            'uniqueCodeEnabled' => $api['uniqueCodeEnabled'],
            'autoCompleteDays' => $api['autoCompleteDays'],
            // Cara serah terima aktif pasar pengunjung (ASUMSI A-85, A-86).
            'deliveryTerms' => DeliveryTerm::active()->forMarket($market)->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (DeliveryTerm $term) => $term->toPublicArray())->values()->all(),
            // Syarat pembayaran aktif pasar pengunjung (ASUMSI A-87); kosong untuk pasar lokal bawaan.
            'paymentTerms' => PaymentTerm::active()->forMarket($market)->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (PaymentTerm $term) => $term->toPublicArray())->values()->all(),
            // Lokasi pabrik (ASUMSI A-90): titik ambil Loco = pabrik asal item yang allowsPickup. `pickup` = pabrik bawaan
            // (urutan pertama) dalam bentuk lama { label, address, lat, lng } untuk FE lama.
            'factories' => $factories->all()->map(fn (FactoryLocation $factory) => $factory->toPublicArray())->values()->all(),
            'pickup' => optional($factories->default())->toPickupArray(),
            // Teks cetakan invoice (penanda tangan, tembusan) untuk halaman cetak customer; prefix nomor tidak perlu di sini.
            'invoice' => [
                'signerName' => $api['invoiceSignerName'],
                'signerTitle' => $api['invoiceSignerTitle'],
                'cc' => $api['invoiceCc'],
            ],
        ]);
    }

    public function paymentMethods()
    {
        return $this->data($this->activeMethods());
    }

    private function activeMethods(): array
    {
        return PaymentMethod::active()->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn (PaymentMethod $method) => $method->toPublicArray())->values()->all();
    }
}
