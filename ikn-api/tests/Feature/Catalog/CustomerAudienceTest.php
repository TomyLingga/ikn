<?php

namespace Tests\Feature\Catalog;

use App\Models\Fee;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CatalogFixtures;
use Tests\TestCase;

// Voucher dan biaya tambahan untuk customer tertentu (ASUMSI A-67): audience all|customers + customerIds[].
class CustomerAudienceTest extends TestCase
{
    use RefreshDatabase, CatalogFixtures;

    private function quoteBody(string $slug, ?string $voucher = null): array
    {
        return array_filter(['items' => [['productSlug' => $slug, 'qty' => 1]], 'voucherCode' => $voucher]);
    }

    public function test_targeted_voucher_only_works_for_listed_customers(): void
    {
        $product = $this->makeProduct(['slug' => 'sarung-egrek', 'price' => 100000], 10);
        $vip = $this->customer();
        $other = $this->customer();
        $voucher = $this->makeVoucher(['code' => 'VIP20', 'value' => 20, 'audience' => Voucher::AUDIENCE_CUSTOMERS]);
        $voucher->customers()->attach($vip->id);

        $this->actingAs($vip)->postJson('/api/v1/cart/quote', $this->quoteBody('sarung-egrek', 'VIP20'))
            ->assertOk()->assertJsonPath('data.discountTotal', 20000)->assertJsonPath('data.voucher.code', 'VIP20');

        $this->app['auth']->forgetGuards();
        $this->actingAs($other)->postJson('/api/v1/cart/quote', $this->quoteBody('sarung-egrek', 'VIP20'))
            ->assertStatus(409)->assertJsonPath('code', 'VOUCHER_INVALID')->assertJsonPath('meta.reason', 'not_eligible');

        // Sasaran "customers" tanpa satu pun customer = tidak berlaku untuk siapa pun (bukan untuk semua).
        $voucher->customers()->detach();
        $this->app['auth']->forgetGuards();
        $this->actingAs($vip)->postJson('/api/v1/cart/quote', $this->quoteBody('sarung-egrek', 'VIP20'))
            ->assertStatus(409)->assertJsonPath('meta.reason', 'not_eligible');
    }

    public function test_targeted_fee_is_charged_only_to_listed_customers_and_hidden_from_public_config(): void
    {
        $this->makeProduct(['slug' => 'sarung-egrek', 'price' => 100000], 10);
        $special = $this->customer();
        $other = $this->customer();
        $this->makeFee(5000); // semua customer
        $handling = Fee::create(['name' => ['id' => 'Biaya penanganan khusus'], 'type' => Fee::TYPE_OTHER, 'amount' => 25000, 'is_active' => true, 'audience' => Fee::AUDIENCE_CUSTOMERS]);
        $handling->customers()->attach($special->id);

        $this->actingAs($special)->postJson('/api/v1/cart/quote', $this->quoteBody('sarung-egrek'))
            ->assertOk()->assertJsonCount(2, 'data.fees')->assertJsonPath('data.feeTotal', 30000)->assertJsonPath('data.grandTotal', 130000);

        $this->app['auth']->forgetGuards();
        $this->actingAs($other)->postJson('/api/v1/cart/quote', $this->quoteBody('sarung-egrek'))
            ->assertOk()->assertJsonCount(1, 'data.fees')->assertJsonPath('data.feeTotal', 5000);

        $this->app['auth']->forgetGuards();
        $config = $this->getJson('/api/v1/commerce/config')->assertOk();
        $config->assertJsonCount(1, 'data.fees')->assertJsonPath('data.fees.0.amount', 5000);
        $this->assertArrayNotHasKey('customers', $config->json('data.fees.0'));
    }

    public function test_admin_sets_and_clears_voucher_audience(): void
    {
        $admin = $this->adminWith(['vouchers']);
        $customer = $this->customer(['name' => 'Budi Santoso']);
        $customer->profile()->create(['company' => 'Coating Solutions Co.']);
        $body = ['code' => 'KHUSUS', 'type' => 'fixed', 'value' => 50000, 'audience' => 'customers', 'customerIds' => [$customer->id]];

        $created = $this->actingAs($admin)->postJson('/api/v1/admin/vouchers', $body)->assertStatus(201)
            ->assertJsonPath('data.audience', 'customers')
            ->assertJsonPath('data.customers.0.id', $customer->id)
            ->assertJsonPath('data.customers.0.company', 'Coating Solutions Co.');
        $id = $created->json('data.id');

        // Wajib minimal satu customer, dan hanya akun ber-role customer.
        $this->actingAs($admin)->postJson('/api/v1/admin/vouchers', ['code' => 'KOSONG', 'type' => 'fixed', 'value' => 1000, 'audience' => 'customers'])
            ->assertStatus(422)->assertJsonValidationErrors(['customerIds']);
        $this->actingAs($admin)->postJson('/api/v1/admin/vouchers', ['code' => 'ADMIN', 'type' => 'fixed', 'value' => 1000, 'audience' => 'customers', 'customerIds' => [$admin->id]])
            ->assertStatus(422)->assertJsonValidationErrors(['customerIds.0']);

        // PUT tanpa `audience` (klien lama) tidak menghapus daftar customer.
        $this->actingAs($admin)->putJson("/api/v1/admin/vouchers/{$id}", ['code' => 'KHUSUS', 'type' => 'fixed', 'value' => 60000])
            ->assertOk()->assertJsonPath('data.audience', 'customers')->assertJsonCount(1, 'data.customers');

        $this->actingAs($admin)->getJson('/api/v1/admin/vouchers?audience=customers')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/vouchers?audience=all')->assertOk()->assertJsonCount(0, 'data');

        $this->actingAs($admin)->putJson("/api/v1/admin/vouchers/{$id}", ['code' => 'KHUSUS', 'type' => 'fixed', 'value' => 60000, 'audience' => 'all'])
            ->assertOk()->assertJsonPath('data.audience', 'all')->assertJsonCount(0, 'data.customers');
        $this->assertDatabaseMissing('voucher_customers', ['voucher_id' => $id]);
    }

    public function test_admin_sets_fee_audience(): void
    {
        $admin = $this->adminWith(['fees']);
        $customer = $this->customer();
        $body = ['name' => ['id' => 'Biaya palet'], 'type' => 'other', 'amount' => 75000, 'audience' => 'customers', 'customerIds' => [$customer->id]];

        $id = $this->actingAs($admin)->postJson('/api/v1/admin/fees', $body)->assertStatus(201)
            ->assertJsonPath('data.audience', 'customers')->assertJsonPath('data.customers.0.id', $customer->id)->json('data.id');

        $this->actingAs($admin)->postJson('/api/v1/admin/fees', ['name' => ['id' => 'Tanpa customer'], 'amount' => 1000, 'audience' => 'customers', 'customerIds' => []])
            ->assertStatus(422)->assertJsonValidationErrors(['customerIds']);

        $this->actingAs($admin)->getJson('/api/v1/admin/fees')->assertOk()->assertJsonPath('data.0.customers.0.email', $customer->email);

        $this->actingAs($admin)->putJson("/api/v1/admin/fees/{$id}", ['name' => ['id' => 'Biaya palet'], 'amount' => 75000, 'audience' => 'all'])
            ->assertOk()->assertJsonPath('data.audience', 'all')->assertJsonCount(0, 'data.customers');
    }

    public function test_customer_sees_only_usable_vouchers_assigned_to_them(): void
    {
        $me = $this->customer();
        $other = $this->customer();
        $assign = function (array $attributes, User ...$users) {
            $voucher = $this->makeVoucher($attributes + ['audience' => Voucher::AUDIENCE_CUSTOMERS]);
            $voucher->customers()->attach(array_map(fn (User $u) => $u->id, $users));

            return $voucher;
        };

        $assign(['code' => 'UNTUKKU', 'type' => Voucher::TYPE_FIXED, 'value' => 25000, 'min_subtotal' => 100000, 'ends_at' => now()->addDays(3)], $me);
        $assign(['code' => 'ORANGLAIN'], $other);
        $assign(['code' => 'NONAKTIF', 'is_active' => false], $me);
        $assign(['code' => 'LEWAT', 'ends_at' => now()->subDay()], $me);
        $assign(['code' => 'HABIS', 'quota' => 1, 'used_count' => 1], $me);
        $this->makeVoucher(['code' => 'UMUM']); // voucher umum tidak didaftar

        $response = $this->actingAs($me)->getJson('/api/v1/customer/vouchers')->assertOk()->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.code', 'UNTUKKU')
            ->assertJsonPath('data.0.type', 'fixed')
            ->assertJsonPath('data.0.value', 25000)
            ->assertJsonPath('data.0.minSubtotal', 100000);
        $this->assertNotNull($response->json('data.0.endsAt'));

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['vouchers']))->getJson('/api/v1/customer/vouchers')->assertStatus(403);
    }

    public function test_customer_options_need_a_related_module_and_list_active_customers(): void
    {
        $budi = $this->customer(['name' => 'Budi Santoso', 'email' => 'budi@coating.co.id']);
        $budi->profile()->create(['company' => 'Coating Solutions Co.']);
        $this->customer(['name' => 'Rina', 'status' => User::STATUS_PENDING]);

        $this->actingAs($this->adminWith(['vouchers']))->getJson('/api/v1/admin/customer-options')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $budi->id)->assertJsonPath('data.0.company', 'Coating Solutions Co.');

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['fees']))->getJson('/api/v1/admin/customer-options?q=coating')->assertOk()->assertJsonCount(1, 'data');
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['fees']))->getJson('/api/v1/admin/customer-options?q=tidak-ada')->assertOk()->assertJsonCount(0, 'data');
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['products']))->getJson('/api/v1/admin/customer-options')->assertStatus(403);
    }
}
