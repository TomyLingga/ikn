<?php

namespace Tests\Feature\Catalog;

use App\Models\BankAccount;
use App\Models\PaymentMethod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CatalogFixtures;
use Tests\TestCase;

// GET /commerce/config, GET /payment-methods (publik) + admin konfigurasi commerce (kontrak 11.5) + /admin/settings.
class CommerceConfigTest extends TestCase
{
    use RefreshDatabase, CatalogFixtures;

    public function test_commerce_config_has_full_shape_and_only_active_rows_without_secret_config(): void
    {
        $qris = $this->makeMedia('qris.png', 'qris');
        $this->makePaymentMethod('manual_transfer', ['sort_order' => 0]);
        $this->makePaymentMethod('qris_static', ['sort_order' => 1, 'config' => ['qrisMediaId' => $qris->id]]);
        $this->makePaymentMethod('ewallet', ['is_active' => false, 'driver' => 'xendit', 'config' => ['channelCode' => 'ID_OVO']]);
        BankAccount::create(['bank_name' => 'Bank BCA', 'account_number' => '0123456789', 'account_holder' => 'PT IKN', 'is_active' => true, 'sort_order' => 0]);
        BankAccount::create(['bank_name' => 'Bank Lama', 'account_number' => '1', 'account_holder' => 'PT IKN', 'is_active' => false]);
        $this->makeFee(5000, true);
        $this->makeFee(9000, false);
        $this->commerceSettings(['paymentDueHours' => 48, 'taxRate' => 11, 'priceIncludesTax' => true, 'uniqueCodeEnabled' => true, 'autoCompleteDays' => 7]);

        $response = $this->getJson('/api/v1/commerce/config')->assertOk();

        $response->assertJsonStructure(['data' => ['paymentMethods', 'bankAccounts', 'fees', 'paymentDueHours', 'taxRate', 'priceIncludesTax', 'uniqueCodeEnabled', 'autoCompleteDays']])
            ->assertJsonCount(2, 'data.paymentMethods')
            ->assertJsonPath('data.paymentMethods.0.code', 'manual_transfer')
            ->assertJsonPath('data.paymentMethods.0.qrisImageUrl', null)
            ->assertJsonPath('data.paymentMethods.1.code', 'qris_static')
            ->assertJsonCount(1, 'data.bankAccounts')
            ->assertJsonPath('data.bankAccounts.0.bankName', 'Bank BCA')
            ->assertJsonPath('data.bankAccounts.0.accountNumber', '0123456789')
            ->assertJsonCount(1, 'data.fees')
            ->assertJsonPath('data.fees.0.amount', 5000)
            ->assertJsonPath('data.paymentDueHours', 48)
            ->assertJsonPath('data.taxRate', 11)
            ->assertJsonPath('data.priceIncludesTax', true)
            ->assertJsonPath('data.uniqueCodeEnabled', true)
            ->assertJsonPath('data.autoCompleteDays', 7);

        $this->assertStringContainsString($qris->path, $response->json('data.paymentMethods.1.qrisImageUrl'));
        $this->assertArrayNotHasKey('config', $response->json('data.paymentMethods.1'));

        $methods = $this->getJson('/api/v1/payment-methods')->assertOk();
        $methods->assertJsonCount(2, 'data')->assertJsonPath('data.1.instructions.id', 'Instruksi');
        $this->assertStringContainsString($qris->path, $methods->json('data.1.qrisImageUrl'));
    }

    public function test_settings_require_settings_module_and_update_partially(): void
    {
        $this->actingAs($this->adminWith(['products']))->getJson('/api/v1/admin/settings')->assertStatus(403);
        $this->actingAs($this->adminWith(['products']))->putJson('/api/v1/admin/settings', ['taxRate' => 12])->assertStatus(403);

        $admin = $this->adminWith(['settings']);
        $this->actingAs($admin)->getJson('/api/v1/admin/settings')->assertOk()
            ->assertJsonPath('data.paymentDueHours', 24)
            ->assertJsonPath('data.uniqueCodeEnabled', true)
            ->assertJsonPath('data.taxRate', 11)
            ->assertJsonPath('data.priceIncludesTax', true)
            ->assertJsonPath('data.autoCompleteDays', 7)
            ->assertJsonPath('data.reminderHoursBeforeDue', 2);

        $this->actingAs($admin)->putJson('/api/v1/admin/settings', ['paymentDueHours' => 48, 'uniqueCodeEnabled' => false, 'taxRate' => 12.5, 'hacker' => true])
            ->assertOk()
            ->assertJsonPath('data.paymentDueHours', 48)
            ->assertJsonPath('data.uniqueCodeEnabled', false)
            ->assertJsonPath('data.taxRate', 12.5)
            ->assertJsonPath('data.priceIncludesTax', true);

        $this->assertDatabaseHas('settings', ['key' => 'commerce.payment_due_hours', 'group' => 'commerce', 'is_public' => false]);
        $this->assertDatabaseMissing('settings', ['key' => 'commerce.hacker']);
        $this->getJson('/api/v1/commerce/config')->assertOk()->assertJsonPath('data.paymentDueHours', 48)->assertJsonPath('data.uniqueCodeEnabled', false);

        $this->actingAs($admin)->putJson('/api/v1/admin/settings', ['paymentDueHours' => 0])->assertStatus(422)->assertJsonStructure(['errors' => ['paymentDueHours']]);
        $this->assertArrayNotHasKey('commerce', $this->getJson('/api/v1/content/settings')->assertOk()->json('data')); // tidak bocor ke settings publik
    }

    public function test_admin_crud_bank_accounts_fees_and_vouchers(): void
    {
        $admin = $this->superAdmin();

        $bank = $this->actingAs($admin)->postJson('/api/v1/admin/bank-accounts', ['bankName' => 'Bank BCA', 'accountNumber' => '0123456789', 'accountHolder' => 'PT IKN'])
            ->assertStatus(201)->assertJsonPath('data.bankName', 'Bank BCA')->assertJsonPath('data.isActive', true)->json('data.id');
        $this->actingAs($admin)->putJson('/api/v1/admin/bank-accounts/'.$bank, ['bankName' => 'Bank BCA', 'accountNumber' => '0123456789', 'accountHolder' => 'PT IKN', 'isActive' => false])
            ->assertOk()->assertJsonPath('data.isActive', false);
        $this->getJson('/api/v1/commerce/config')->assertJsonPath('data.bankAccounts', []);
        $this->actingAs($this->adminWith(['fees']))->getJson('/api/v1/admin/bank-accounts')->assertStatus(403);
        $this->actingAs($admin)->deleteJson('/api/v1/admin/bank-accounts/'.$bank)->assertOk();

        $fee = $this->actingAs($admin)->postJson('/api/v1/admin/fees', ['name' => ['id' => 'Biaya administrasi'], 'type' => 'admin', 'amount' => 5000])
            ->assertStatus(201)->assertJsonPath('data.amount', 5000)->assertJsonPath('data.name.en', 'Biaya administrasi')->json('data.id');
        $this->actingAs($admin)->postJson('/api/v1/admin/fees', ['name' => ['id' => 'X'], 'amount' => 12.5])->assertStatus(422);
        $this->actingAs($admin)->deleteJson('/api/v1/admin/fees/'.$fee)->assertOk();

        $category = $this->makeCategory();
        $voucher = $this->actingAs($admin)->postJson('/api/v1/admin/vouchers', [
            'code' => 'ikn10', 'type' => 'percent', 'value' => 10, 'minSubtotal' => 5000000, 'maxDiscount' => 2000000,
            'quota' => 100, 'perUserLimit' => 2, 'scope' => 'category', 'categoryIds' => [$category->id], 'endsAt' => now()->addYear()->toIso8601String(),
        ])->assertStatus(201)
            ->assertJsonPath('data.code', 'IKN10')
            ->assertJsonPath('data.usedCount', 0)
            ->assertJsonPath('data.scope', 'category')
            ->assertJsonPath('data.categoryIds', [$category->id])
            ->assertJsonPath('data.maxDiscount', 2000000)
            ->json('data.id');
        $this->actingAs($admin)->postJson('/api/v1/admin/vouchers', ['code' => 'IKN10', 'type' => 'percent', 'value' => 10])->assertStatus(422);
        $this->actingAs($admin)->postJson('/api/v1/admin/vouchers', ['code' => 'BESAR', 'type' => 'percent', 'value' => 150])->assertStatus(422);
        $this->actingAs($admin)->getJson('/api/v1/admin/vouchers?q=ikn')->assertOk()->assertJsonPath('meta.total', 1);
        $this->actingAs($admin)->putJson('/api/v1/admin/vouchers/'.$voucher, ['code' => 'IKN10', 'type' => 'fixed', 'value' => 150000, 'scope' => 'all'])
            ->assertOk()->assertJsonPath('data.type', 'fixed')->assertJsonPath('data.value', 150000)->assertJsonPath('data.scope', 'all');
        $this->actingAs($admin)->deleteJson('/api/v1/admin/vouchers/'.$voucher)->assertOk();
    }

    public function test_admin_manages_shipping_zones_rates_and_alias_methods(): void
    {
        $admin = $this->adminWith(['shipping']);

        $zone = $this->actingAs($admin)->postJson('/api/v1/admin/shipping-zones', [
            'name' => ['id' => 'Sumatera Utara', 'en' => 'North Sumatra'], 'priority' => 10,
            'regions' => [['code' => '12', 'level' => 'province'], ['code' => '12', 'level' => 'province']],
        ])->assertStatus(201)->assertJsonPath('data.regions', [['code' => '12', 'level' => 'province']])->assertJsonPath('data.rates', [])->json('data.id');

        $rate = $this->actingAs($admin)->postJson('/api/v1/admin/shipping-zones/'.$zone.'/rates', [
            'name' => ['id' => 'Reguler'], 'type' => 'per_kg', 'baseAmount' => 25000, 'perKgAmount' => 2000, 'freeAbove' => 25000000, 'eta' => ['id' => '2–4 hari'],
        ])->assertStatus(201)->assertJsonPath('data.baseAmount', 25000)->assertJsonPath('data.freeAbove', 25000000)->assertJsonPath('data.zone.id', $zone)->json('data.id');

        $this->actingAs($admin)->postJson('/api/v1/admin/shipping-zones/'.$zone.'/rates', ['name' => ['id' => 'X'], 'type' => 'harian'])->assertStatus(422);

        $this->actingAs($admin)->getJson('/api/v1/admin/shipping-methods')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $rate)
            ->assertJsonPath('data.0.zoneId', $zone)
            ->assertJsonPath('data.0.zone.name.id', 'Sumatera Utara')
            ->assertJsonPath('data.0.label.id', 'Reguler')
            ->assertJsonPath('data.0.type', 'per_kg')
            ->assertJsonPath('data.0.perKgAmount', 2000)
            ->assertJsonPath('data.0.minAmount', 0)
            ->assertJsonPath('data.0.eta.id', '2–4 hari')
            ->assertJsonPath('data.0.isActive', true);

        $this->actingAs($admin)->putJson('/api/v1/admin/shipping-rates/'.$rate, ['name' => ['id' => 'Reguler'], 'type' => 'flat', 'baseAmount' => 30000, 'isActive' => false])
            ->assertOk()->assertJsonPath('data.type', 'flat')->assertJsonPath('data.isActive', false)->assertJsonPath('data.freeAbove', null);

        $this->actingAs($admin)->putJson('/api/v1/admin/shipping-zones/'.$zone, ['name' => ['id' => 'Sumut'], 'regions' => [['code' => '12.71', 'level' => 'regency']]])
            ->assertOk()->assertJsonPath('data.regions.0.code', '12.71')->assertJsonCount(1, 'data.rates');

        $this->actingAs($admin)->deleteJson('/api/v1/admin/shipping-rates/'.$rate)->assertOk();
        $this->actingAs($admin)->deleteJson('/api/v1/admin/shipping-zones/'.$zone)->assertOk();
        $this->assertDatabaseMissing('shipping_zone_regions', ['zone_id' => $zone]);
    }

    public function test_admin_manages_payment_methods_with_config_whitelist(): void
    {
        $admin = $this->adminWith(['payment_methods']);
        $qris = $this->makeMedia('qris.png', 'qris');

        $created = $this->actingAs($admin)->postJson('/api/v1/admin/payment-methods', [
            'code' => 'QRIS_Static', 'type' => 'qris_static', 'name' => ['id' => 'QRIS'], 'instructions' => ['id' => 'Pindai'],
            'config' => ['qrisMediaId' => $qris->id, 'secretKey' => 'xnd_rahasia', 'apiToken' => 'abc'], 'isActive' => true, 'sortOrder' => 1,
        ])->assertStatus(201)
            ->assertJsonPath('data.code', 'qris_static')
            ->assertJsonPath('data.driver', 'manual')
            ->assertJsonPath('data.config.qrisMediaId', $qris->id);
        $this->assertSame(['qrisMediaId' => $qris->id], $created->json('data.config'));
        $id = $created->json('data.id');

        $this->assertStringContainsString($qris->path, $this->actingAs($admin)->getJson('/api/v1/admin/payment-methods/'.$id)->json('data.qrisImageUrl'));
        $this->assertSame(['qrisMediaId' => $qris->id], PaymentMethod::find($id)->config);

        $this->actingAs($admin)->postJson('/api/v1/admin/payment-methods', ['code' => 'qris_static', 'type' => 'qris_static', 'name' => ['id' => 'Dup']])->assertStatus(422);
        $this->actingAs($admin)->postJson('/api/v1/admin/payment-methods', ['code' => 'x', 'type' => 'bitcoin', 'name' => ['id' => 'X']])->assertStatus(422);
        $this->actingAs($admin)->postJson('/api/v1/admin/payment-methods', ['code' => 'va', 'type' => 'virtual_account', 'driver' => 'midtrans', 'name' => ['id' => 'X']])->assertStatus(422);

        $this->actingAs($admin)->putJson('/api/v1/admin/payment-methods/'.$id, [
            'code' => 'qris_static', 'type' => 'qris_static', 'name' => ['id' => 'QRIS Toko'], 'isActive' => false,
        ])->assertOk()->assertJsonPath('data.isActive', false)->assertJsonPath('data.config.qrisMediaId', $qris->id); // config dipertahankan bila tidak dikirim

        $this->getJson('/api/v1/payment-methods')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($this->adminWith(['fees']))->getJson('/api/v1/admin/payment-methods')->assertStatus(403);
        $this->actingAs($admin)->deleteJson('/api/v1/admin/payment-methods/'.$id)->assertStatus(405);
    }
}
