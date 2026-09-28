<?php

namespace Tests\Support;

use App\Models\BankAccount;
use App\Models\CustomerAddress;
use App\Models\Media;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ShippingRate;
use App\Models\User;
use App\Services\Commerce\CheckoutService;
use App\Services\Payment\PaymentService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Fixture area order & pembayaran (BE-3): customer aktif + alamat Jakarta, zona/tarif Jawa, metode manual_transfer
 * + rekening, settings commerce, helper checkout lewat CheckoutService (bukan insert mentah).
 */
trait CommerceFixtures
{
    use CatalogFixtures, SeedsRegions;

    protected User $buyer;

    protected CustomerAddress $buyerAddress;

    protected ShippingRate $rate;

    protected PaymentMethod $manualTransfer;

    protected BankAccount $bank;

    /** Siapkan semua prasyarat checkout; kembalikan customer aktif. */
    protected function setUpCommerce(array $settings = []): User
    {
        Storage::fake('private');
        $this->seedRegions();

        $this->buyer = $this->customer(['email' => 'buyer@coatingsolutions.co.id', 'name' => 'Budi Santoso', 'locale' => 'id']);
        $this->buyer->profile()->create(['company' => 'Coating Solutions Co.', 'phone' => '081234567890', 'tax_id' => '01.234.567.8-901.000']);
        $this->buyerAddress = $this->buyer->addresses()->create($this->addressAttributes());

        $zone = $this->makeZone([['31', 'province']], [
            'name' => ['id' => 'Reguler', 'en' => 'Regular'], 'type' => ShippingRate::TYPE_PER_KG,
            'base_amount' => 50000, 'per_kg_amount' => 3500, 'min_amount' => 60000, 'free_above' => null,
            'eta' => ['id' => '4–7 hari', 'en' => '4–7 days'],
        ], ['name' => ['id' => 'Jawa', 'en' => 'Java']]);
        $this->rate = $zone->rates()->first();

        $this->manualTransfer = $this->makePaymentMethod('manual_transfer', [
            'name' => ['id' => 'Transfer Bank Manual', 'en' => 'Manual Bank Transfer'],
            'instructions' => ['id' => 'Transfer ke rekening di bawah.', 'en' => 'Transfer to the account below.'],
        ]);
        $this->bank = BankAccount::create(['bank_name' => 'Bank BCA', 'account_number' => '0123456789', 'account_holder' => 'PT Industri Karet Nusantara', 'is_active' => true, 'sort_order' => 0]);

        $this->commerceSettings(array_merge([
            'paymentDueHours' => 24, 'uniqueCodeEnabled' => true, 'taxRate' => 11, 'priceIncludesTax' => true,
            'autoCompleteDays' => 7, 'reminderHoursBeforeDue' => 2,
        ], $settings));

        return $this->buyer;
    }

    /** Atribut alamat (kolom snake_case) dari payload kontrak jakartaAddress(). */
    protected function addressAttributes(array $overrides = []): array
    {
        $payload = $this->jakartaAddress();

        return array_merge([
            'label' => $payload['label'], 'recipient_name' => $payload['recipientName'], 'phone' => $payload['phone'],
            'address_line' => $payload['addressLine'], 'province_code' => $payload['provinceCode'], 'regency_code' => $payload['regencyCode'],
            'district_code' => $payload['districtCode'], 'village_code' => $payload['villageCode'], 'postal_code' => $payload['postalCode'],
            'lat' => $payload['lat'], 'lng' => $payload['lng'], 'note' => $payload['note'], 'is_default' => true,
        ], $overrides);
    }

    /** Body POST /customer/orders (kontrak bagian 9) untuk satu produk. */
    protected function checkoutPayload(Product $product, int $qty = 1, array $overrides = []): array
    {
        return array_merge([
            'items' => [['productSlug' => $product->slug, 'qty' => $qty]],
            'addressId' => $this->buyerAddress->id,
            'shippingRateId' => $this->rate->id,
            'paymentMethodCode' => $this->manualTransfer->code,
            'bankAccountId' => $this->bank->id,
        ], $overrides);
    }

    /** Checkout langsung lewat service (lebih cepat daripada HTTP untuk menyiapkan skenario). */
    protected function placeOrder(Product $product, int $qty = 1, array $overrides = [], ?string $idempotencyKey = null, ?User $user = null): Order
    {
        return app(CheckoutService::class)->place($user ?? $this->buyer, $this->checkoutPayload($product, $qty, $overrides), $idempotencyKey);
    }

    protected function proofFile(string $name = 'bukti.pdf'): UploadedFile
    {
        return UploadedFile::fake()->create($name, 120, 'application/pdf');
    }

    /** Unggah bukti (order → payment_review). */
    protected function uploadProof(Order $order, ?int $paymentId = null): Payment
    {
        return app(PaymentService::class)->uploadProof($order, $this->proofFile(), $paymentId, $this->buyer);
    }

    /** Unggah bukti lalu admin accept → order paid. */
    protected function payOrder(Order $order, ?User $admin = null): Order
    {
        $payment = $this->uploadProof($order);
        app(PaymentService::class)->accept($payment, $admin ?? $this->superAdmin());

        return $order->fresh();
    }

    protected function proofMedia(): Media
    {
        return Media::create([
            'disk' => Media::DISK_PRIVATE, 'path' => 'payment-proofs/test/'.uniqid().'.pdf', 'original_name' => 'bukti.pdf',
            'mime' => 'application/pdf', 'size' => 1234, 'collection' => 'payment-proofs',
        ]);
    }
}
