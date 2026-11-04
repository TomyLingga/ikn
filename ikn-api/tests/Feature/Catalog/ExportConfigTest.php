<?php

namespace Tests\Feature\Catalog;

use App\Models\BankAccount;
use App\Models\Fee;
use App\Models\PaymentTerm;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Konfigurasi ekspor (kontrak 11.5, 11.9, 11.10; ASUMSI A-86, A-87): CRUD syarat pembayaran + 409 saat dipakai order,
// rekening bank bermata uang + SWIFT, fee bermata uang, setting ekspor, dan GET /commerce/config mengikuti pasar pengunjung.
class ExportConfigTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_payment_terms_crud_requires_module_and_blocks_delete_when_used(): void
    {
        $admin = $this->adminWith(['payment_methods']);
        $this->actingAs($this->adminWith(['products']))->getJson('/api/v1/admin/payment-terms')->assertStatus(403);

        // Baris bawaan dari migrasi (pola A-59) + ordersCount.
        $list = $this->actingAs($admin)->getJson('/api/v1/admin/payment-terms')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.code', 'tt_advance')->assertJsonPath('data.0.market', 'export')->assertJsonPath('data.0.ordersCount', 0)
            ->assertJsonPath('data.1.code', 'tt_30_70')->assertJsonPath('data.1.name.en', '30% T/T advance, 70% against copy of B/L');
        $this->assertSame(PaymentTerm::count(), count($list->json('data')));

        $created = $this->actingAs($admin)->postJson('/api/v1/admin/payment-terms', [
            'code' => ' LC-Sight ', 'name' => ['id' => 'L/C at sight'], 'description' => ['id' => 'Letter of credit dibayar saat dokumen diserahkan.'], 'sortOrder' => 3,
        ])->assertCreated()->assertJsonPath('data.code', 'lc-sight')->assertJsonPath('data.market', 'export')->assertJsonPath('data.isActive', true)
            ->assertJsonPath('data.name.en', 'L/C at sight');
        $id = $created->json('data.id');

        $this->actingAs($admin)->postJson('/api/v1/admin/payment-terms', ['code' => 'lc-sight', 'name' => ['id' => 'Dup']])->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->actingAs($admin)->postJson('/api/v1/admin/payment-terms', ['code' => 'Bad Code!', 'name' => ['id' => 'X']])->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->actingAs($admin)->putJson("/api/v1/admin/payment-terms/$id", ['code' => 'lain', 'name' => ['id' => 'L/C at sight']])->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->actingAs($admin)->putJson("/api/v1/admin/payment-terms/$id", ['name' => ['id' => 'L/C at sight', 'en' => 'L/C at sight'], 'isActive' => false, 'market' => 'local'])
            ->assertOk()->assertJsonPath('data.isActive', false)->assertJsonPath('data.market', 'local');
        $this->actingAs($admin)->deleteJson("/api/v1/admin/payment-terms/$id")->assertOk();
        $this->assertDatabaseMissing('payment_terms', ['id' => $id]);

        // Dipakai order → 409 PAYMENT_TERM_IN_USE.
        $this->setUpCommerce();
        $this->setUpExport();
        $product = $this->makeProduct(['price' => 100000, 'price_usd' => '7.00'], 50);
        app(\App\Services\Commerce\CheckoutService::class)->place($this->exporter, $this->exportCheckoutPayload($product, 1));
        $advance = PaymentTerm::where('code', 'tt_advance')->firstOrFail();
        $this->actingAs($admin)->deleteJson("/api/v1/admin/payment-terms/{$advance->id}")->assertStatus(409)->assertJsonPath('code', 'PAYMENT_TERM_IN_USE');
        $this->actingAs($admin)->getJson('/api/v1/admin/payment-terms')->assertOk()->assertJsonPath('data.0.ordersCount', 1);
    }

    public function test_bank_accounts_and_fees_carry_currency_and_swift_fields(): void
    {
        $admin = $this->adminWith(['bank_accounts', 'fees']);

        $bank = $this->actingAs($admin)->postJson('/api/v1/admin/bank-accounts', [
            'bankName' => 'Bank Mandiri', 'accountNumber' => '1060012345678', 'accountHolder' => 'PT Industri Karet Nusantara',
            'currency' => 'usd', 'swiftCode' => 'bmri idja', 'bankAddress' => 'Jakarta', 'correspondentBank' => 'Citibank N.A., New York',
        ])->assertCreated()->assertJsonPath('data.currency', 'USD')->assertJsonPath('data.swiftCode', 'BMRIIDJA')
            ->assertJsonPath('data.bankAddress', 'Jakarta')->assertJsonPath('data.correspondentBank', 'Citibank N.A., New York');
        $id = $bank->json('data.id');

        $this->actingAs($admin)->postJson('/api/v1/admin/bank-accounts', ['bankName' => 'X', 'accountNumber' => '1', 'accountHolder' => 'Y', 'swiftCode' => 'ABC'])
            ->assertStatus(422)->assertJsonValidationErrors(['swiftCode']);
        $this->actingAs($admin)->postJson('/api/v1/admin/bank-accounts', ['bankName' => 'X', 'accountNumber' => '2', 'accountHolder' => 'Y', 'currency' => 'EUR'])
            ->assertStatus(422)->assertJsonValidationErrors(['currency']);
        // PUT tanpa field opsional mempertahankan nilai lama; IDR bawaan untuk rekening tanpa currency.
        $this->actingAs($admin)->putJson("/api/v1/admin/bank-accounts/$id", ['bankName' => 'Bank Mandiri', 'accountNumber' => '1060012345678', 'accountHolder' => 'PT IKN'])
            ->assertOk()->assertJsonPath('data.currency', 'USD')->assertJsonPath('data.swiftCode', 'BMRIIDJA');
        $this->actingAs($admin)->putJson("/api/v1/admin/bank-accounts/$id", ['bankName' => 'Bank Mandiri', 'accountNumber' => '1060012345678', 'accountHolder' => 'PT IKN', 'correspondentBank' => ''])
            ->assertOk()->assertJsonPath('data.correspondentBank', null);
        $idr = $this->actingAs($admin)->postJson('/api/v1/admin/bank-accounts', ['bankName' => 'Bank BCA', 'accountNumber' => '0123456789', 'accountHolder' => 'PT IKN'])
            ->assertCreated()->assertJsonPath('data.currency', 'IDR')->assertJsonPath('data.swiftCode', null);
        $this->assertSame('IDR', BankAccount::findOrFail($idr->json('data.id'))->currency);

        // Fee USD: amount dalam sen → DB 25.00.
        $fee = $this->actingAs($admin)->postJson('/api/v1/admin/fees', ['name' => ['id' => 'Biaya dokumen ekspor'], 'amount' => 2500, 'currency' => 'USD'])
            ->assertCreated()->assertJsonPath('data.currency', 'USD')->assertJsonPath('data.amount', 2500);
        $this->assertSame('25.00', Fee::findOrFail($fee->json('data.id'))->amount);
        $this->actingAs($admin)->putJson("/api/v1/admin/fees/{$fee->json('data.id')}", ['name' => ['id' => 'Biaya dokumen ekspor'], 'amount' => 3000])
            ->assertOk()->assertJsonPath('data.currency', 'USD')->assertJsonPath('data.amount', 3000);
        $this->actingAs($admin)->postJson('/api/v1/admin/fees', ['name' => ['id' => 'Admin'], 'amount' => 5000])->assertCreated()->assertJsonPath('data.currency', 'IDR')->assertJsonPath('data.amount', 5000);
    }

    public function test_export_settings_and_delivery_term_tax_profile(): void
    {
        $admin = $this->adminWith(['settings', 'shipping']);

        $this->actingAs($admin)->getJson('/api/v1/admin/settings')->assertOk()->assertJsonPath('data.exportTaxRate', 0)->assertJsonPath('data.exportPaymentDueHours', 120);
        $this->actingAs($admin)->putJson('/api/v1/admin/settings', ['exportTaxRate' => 5.5, 'exportPaymentDueHours' => 72])
            ->assertOk()->assertJsonPath('data.exportTaxRate', 5.5)->assertJsonPath('data.exportPaymentDueHours', 72);
        $this->actingAs($admin)->putJson('/api/v1/admin/settings', ['exportTaxRate' => 101])->assertStatus(422)->assertJsonValidationErrors(['exportTaxRate']);
        $this->actingAs($admin)->putJson('/api/v1/admin/settings', ['exportPaymentDueHours' => 0])->assertStatus(422)->assertJsonValidationErrors(['exportPaymentDueHours']);

        // Baris bawaan FOB/CIF sudah export oleh migrasi; term baru mengikuti pasar bila taxProfile kosong.
        $terms = $this->actingAs($admin)->getJson('/api/v1/admin/delivery-terms')->assertOk()->json('data');
        $byCode = array_column($terms, null, 'code');
        $this->assertSame('export', $byCode['fob']['taxProfile']);
        $this->assertSame('export', $byCode['cif']['taxProfile']);
        $this->assertSame('domestic', $byCode['loco']['taxProfile']);

        $this->actingAs($admin)->postJson('/api/v1/admin/delivery-terms', ['code' => 'fob-dumai', 'name' => ['id' => 'FOB Dumai'], 'family' => 'port', 'market' => 'export', 'pricingMode' => 'included'])
            ->assertCreated()->assertJsonPath('data.taxProfile', 'export');
        $this->actingAs($admin)->postJson('/api/v1/admin/delivery-terms', ['code' => 'loco-ekspor', 'name' => ['id' => 'Loco ekspor'], 'family' => 'pickup', 'market' => 'export', 'pricingMode' => 'none', 'taxProfile' => 'domestic'])
            ->assertCreated()->assertJsonPath('data.taxProfile', 'domestic');
        $this->actingAs($admin)->postJson('/api/v1/admin/delivery-terms', ['code' => 'x', 'name' => ['id' => 'X'], 'family' => 'door', 'market' => 'local', 'pricingMode' => 'zone', 'taxProfile' => 'lain'])
            ->assertStatus(422)->assertJsonValidationErrors(['taxProfile']);
    }

    public function test_commerce_config_follows_viewer_market(): void
    {
        $this->setUpCommerce();
        $this->setUpExport();
        $this->makeFee(5000); // IDR
        $this->makeFee(2500, true, 'USD');

        // Tamu = pasar lokal: term lokal, tanpa syarat bayar (bawaan hanya ekspor), fee IDR, semua rekening aktif + mata uangnya.
        $guest = $this->getJson('/api/v1/commerce/config')->assertOk()
            ->assertJsonPath('data.market', 'local')->assertJsonPath('data.currency', 'IDR')
            ->assertJsonPath('data.paymentTerms', [])->assertJsonCount(1, 'data.fees')->assertJsonPath('data.fees.0.currency', 'IDR')
            ->assertJsonPath('data.exportTaxRate', 0)->assertJsonPath('data.exportPaymentDueHours', 120)->assertJsonPath('data.paymentDueHours', 24);
        $this->assertSame(['franco', 'loco'], array_column($guest->json('data.deliveryTerms'), 'code'));
        $this->assertEqualsCanonicalizing(['IDR', 'USD'], array_column($guest->json('data.bankAccounts'), 'currency'));
        $usd = collect($guest->json('data.bankAccounts'))->firstWhere('currency', 'USD');
        $this->assertSame('BMRIIDJA', $usd['swiftCode']);

        // Customer ekspor: term ekspor (FOB, CIF), syarat bayar ekspor, fee USD.
        $export = $this->actingAs($this->exporter)->getJson('/api/v1/commerce/config')->assertOk()
            ->assertJsonPath('data.market', 'export')->assertJsonPath('data.currency', 'USD')
            ->assertJsonCount(2, 'data.paymentTerms')->assertJsonPath('data.paymentTerms.0.code', 'tt_advance')
            ->assertJsonCount(1, 'data.fees')->assertJsonPath('data.fees.0.currency', 'USD')->assertJsonPath('data.fees.0.amount', 2500);
        $this->assertSame(['fob', 'cif'], array_column($export->json('data.deliveryTerms'), 'code'));
        $this->assertSame('export', $export->json('data.deliveryTerms.0.taxProfile'));
    }
}
