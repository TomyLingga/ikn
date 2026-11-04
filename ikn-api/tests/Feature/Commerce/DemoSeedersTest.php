<?php

namespace Tests\Feature\Commerce;

use App\Models\BankAccount;
use App\Models\Fee;
use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Models\OrderProforma;
use App\Models\PaymentTerm;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\CommerceConfigSeeder;
use Database\Seeders\CommerceDemoSeeder;
use Database\Seeders\CustomerSeeder;
use Database\Seeders\DeliveryTermSeeder;
use Database\Seeders\PaymentTermSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

// Seeder demo commerce berjalan dan idempoten (acceptance Phase E3/E4/E5): customer ekspor, rekening USD, fee USD, harga USD produk,
// syarat pembayaran bawaan, satu order USD FOB menunggu pembayaran dengan proforma revisi 1, dan satu order CIF menunggu penawaran ongkir.
class DemoSeedersTest extends TestCase
{
    use RefreshDatabase;

    public function test_commerce_demo_seeders_run_twice_without_duplicates_and_create_an_export_order(): void
    {
        Storage::fake('public');
        Storage::fake('private');

        $seeders = [UserSeeder::class, CustomerSeeder::class, CatalogSeeder::class, CommerceConfigSeeder::class, DeliveryTermSeeder::class, PaymentTermSeeder::class, CommerceDemoSeeder::class];
        foreach ($seeders as $seeder) {
            $this->seed($seeder);
        }

        $exporter = User::where('email', 'buyer@rubbertrade.example')->firstOrFail();
        $this->assertTrue($exporter->isExport());
        $this->assertSame('MY', $exporter->profile->country_code);
        $this->assertSame('USD', $exporter->currency());

        $this->assertSame('11.50', Product::where('slug', 'resiprene-35')->value('price_usd'));
        $this->assertNull(Product::where('slug', 'rubber-membrane')->value('price_usd')); // quote mode
        $this->assertTrue(BankAccount::active()->forCurrency('USD')->exists());
        $this->assertTrue(Fee::active()->forCurrency('USD')->where('name->id', 'Biaya dokumen ekspor')->exists());
        $this->assertSame(2, PaymentTerm::count());

        $usd = Order::where('user_id', $exporter->id)->get();
        $this->assertCount(2, $usd);
        $order = $usd->firstWhere('delivery_term', 'fob');
        $this->assertNotNull($order);
        $this->assertSame('USD', $order->currency);
        $this->assertSame('fob', $order->delivery_term);
        $this->assertSame('tt_advance', $order->payment_term_code);
        $this->assertSame(Order::STATUS_PENDING_PAYMENT, $order->status);
        $this->assertSame('port', $order->shipping_address_snapshot['type']);
        $this->assertSame('USD', $order->activePayment()->currency);
        $this->assertSame('USD', $order->activePayment()->bankAccount->currency);
        // 500 kg × USD 11,50 + fee USD 25,00 = USD 5.775,00 (pajak ekspor 0, tanpa kode unik).
        $this->assertSame(577500, $order->grandTotalInt());
        $this->assertSame(0, (int) $order->unique_code);
        // Proforma revisi 1 (ASUMSI A-88) dengan bawaan dari term dan syarat bayar.
        $proforma = $order->proforma;
        $this->assertNotNull($proforma);
        $this->assertSame(1, $proforma->revision);
        $this->assertSame('Belawan', $proforma->port_of_loading);
        $this->assertSame('Port Klang', $proforma->port_of_discharge);
        $this->assertNotNull($proforma->payment_terms);
        $this->assertSame('PI/'.$order->number, $proforma->label());

        // Order CIF (ASUMSI A-89): menunggu penawaran ongkir, tanpa payment, pelabuhan tujuan tersimpan, satu penawaran admin 3 baris.
        $cif = $usd->firstWhere('delivery_term', 'cif');
        $this->assertNotNull($cif);
        $this->assertSame(Order::STATUS_AWAITING_FREIGHT, $cif->status);
        $this->assertNull($cif->payment_due_at);
        $this->assertSame(0, $cif->payments()->count());
        $this->assertSame('Port Klang', $cif->destination_port['name']);
        $this->assertSame('MY', $cif->destination_port['countryCode']);
        $this->assertSame('manual_transfer', $cif->pending_payment_method['code']);
        $this->assertSame(1, OrderFreightQuote::where('order_id', $cif->id)->count());
        $quote = $cif->activeFreightQuote();
        $this->assertNotNull($quote);
        $this->assertCount(3, $quote->lines);
        $this->assertSame(81500, $quote->totalMinor());
        $this->assertTrue($cif->canAcceptFreightQuote());

        $orders = Order::count();
        $fees = Fee::count();
        $banks = BankAccount::count();
        foreach ($seeders as $seeder) {
            $this->seed($seeder);
        }
        $this->assertSame($orders, Order::count());
        $this->assertSame($fees, Fee::count());
        $this->assertSame($banks, BankAccount::count());
        $this->assertSame(2, PaymentTerm::count());
        $this->assertSame(1, OrderProforma::count());
        $this->assertSame(1, OrderFreightQuote::count());
    }
}
