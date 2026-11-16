<?php

namespace Tests\Feature\Commerce;

use App\Models\BankAccount;
use App\Models\Fee;
use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Models\OrderInstallment;
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
        // Cakupan ekspor (2026-11-04): FOB & CIF di berbagai status, dua syarat bayar; + tiga order termin (2026-11-16).
        $this->assertCount(14, $usd);
        $this->assertEqualsCanonicalizing(['pending_payment', 'payment_review', 'processing', 'shipped', 'completed', 'expired'], $usd->where('delivery_term', 'fob')->pluck('status')->unique()->values()->all());
        $this->assertEqualsCanonicalizing(['awaiting_freight', 'pending_payment', 'completed', 'cancelled'], $usd->where('delivery_term', 'cif')->pluck('status')->unique()->values()->all());
        $this->assertEqualsCanonicalizing(['tt_advance', 'tt_30_70'], $usd->pluck('payment_term_code')->unique()->values()->all());
        $this->assertEqualsCanonicalizing(
            ['pending_payment', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'expired'],
            Order::where('delivery_term', 'loco')->pluck('status')->unique()->values()->all()
        );
        $order = $usd->first(fn (Order $o) => $o->delivery_term === 'fob' && $o->status === Order::STATUS_PENDING_PAYMENT);
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
        $cif = $usd->first(fn (Order $o) => $o->delivery_term === 'cif' && $o->status === Order::STATUS_AWAITING_FREIGHT && ($o->destination_port['name'] ?? '') === 'Port Klang');
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

        // Termin (ASUMSI A-97) pada syarat 30/70: lunas penuh, uang muka lunas + pelunasan belum ditagih, pelunasan
        // ditagih, pelunasan menunggu verifikasi, dan uang muka menunggu verifikasi. Order CIF 30/70 yang masih menunggu
        // ongkir belum punya termin; order 100% di muka tidak pernah punya.
        $termin = $usd->where('payment_term_code', 'tt_30_70')->filter(fn (Order $o) => $o->installments()->exists())
            ->map(fn (Order $o) => $o->status.':'.implode('/', $o->installments()->pluck('status')->all()))->values()->all();
        $this->assertEqualsCanonicalizing([
            'completed:paid/paid', 'processing:paid/scheduled', 'shipped:paid/due', 'shipped:paid/awaiting_verification', 'payment_review:awaiting_verification/scheduled',
        ], $termin);
        $this->assertSame(0, OrderInstallment::whereIn('order_id', $usd->where('payment_term_code', 'tt_advance')->pluck('id'))->count());
        $this->assertSame(0, OrderInstallment::whereNotIn('order_id', $usd->pluck('id'))->count()); // order rupiah tanpa termin
        foreach ($usd->filter(fn (Order $o) => $o->installments()->exists()) as $o) {
            $this->assertSame($o->grandTotalInt(), $o->installments->sum(fn (OrderInstallment $row) => $row->amountInt()));
        }
        $settled = $usd->first(fn (Order $o) => $o->status === Order::STATUS_COMPLETED && $o->payment_term_code === 'tt_30_70');
        $this->assertSame('paid', $settled->paymentProgress()['status']);
        $this->assertSame(2, $settled->payments()->where('status', 'paid')->count());

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
        $this->assertSame(2, OrderProforma::count());
        // Putaran penawaran CIF: diajukan, ditawar balik (lama digantikan), diterima, kedaluwarsa.
        $this->assertSame(6, OrderFreightQuote::count());
    }
}
