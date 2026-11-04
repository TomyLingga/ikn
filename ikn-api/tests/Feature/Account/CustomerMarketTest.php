<?php

namespace Tests\Feature\Account;

use App\Mail\Account\AccountApproved;
use App\Models\CustomerProfile;
use App\Models\Order;
use App\Models\User;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Pasar customer (kontrak 11.9, ASUMSI A-86): negara saat daftar, pasar dikunci admin saat menyetujui,
// pasar tidak bisa diubah bila ada order berjalan, filter daftar admin, negara/alamat hanya diubah selagi pending.
class CustomerMarketTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    private function registerPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Ahmad Faizal', 'email' => 'buyer@rubbertrade.example', 'password' => 'Rahasia123', 'passwordConfirmation' => 'Rahasia123',
            'phone' => '+60123456789', 'company' => 'Rubber Trade Sdn. Bhd.',
        ], $overrides);
    }

    public function test_register_stores_country_and_company_address_and_defaults_to_local_indonesia(): void
    {
        Mail::fake();

        $this->fromFrontend()->postJson('/api/v1/auth/register', $this->registerPayload(['countryCode' => 'my', 'companyAddress' => ' Lot 12, Pasir Gudang, Johor ']))
            ->assertCreated();
        $user = User::where('email', 'buyer@rubbertrade.example')->firstOrFail();
        $this->assertDatabaseHas('customer_profiles', ['user_id' => $user->id, 'country_code' => 'MY', 'market' => 'local', 'company_address' => 'Lot 12, Pasir Gudang, Johor']);

        $this->fromFrontend()->postJson('/api/v1/auth/register', $this->registerPayload(['email' => 'lokal@contoh.co.id']))->assertCreated();
        $local = User::where('email', 'lokal@contoh.co.id')->firstOrFail();
        $this->assertDatabaseHas('customer_profiles', ['user_id' => $local->id, 'country_code' => 'ID', 'market' => 'local', 'company_address' => null]);

        $this->fromFrontend()->postJson('/api/v1/auth/register', $this->registerPayload(['email' => 'x@contoh.co.id', 'countryCode' => 'XX']))
            ->assertStatus(422)->assertJsonValidationErrors(['countryCode']);

        $countries = $this->getJson('/api/v1/countries')->assertOk();
        $this->assertSame('ID', $countries->json('data.0.code'));
        $this->assertSame('Indonesia', $countries->json('data.0.name.id'));
        $this->assertContains('MY', array_column($countries->json('data'), 'code'));
        $this->assertGreaterThan(240, count($countries->json('data')));
    }

    public function test_customer_changes_country_and_address_only_while_pending(): void
    {
        $pending = $this->customer(['status' => User::STATUS_PENDING]);
        $pending->profile()->create(['company' => 'PT Baru', 'country_code' => 'ID']);

        $this->actingAs($pending)->getJson('/api/v1/customer/profile')->assertOk()
            ->assertJsonPath('data.market', 'local')->assertJsonPath('data.currency', 'IDR')
            ->assertJsonPath('data.countryCode', 'ID')->assertJsonPath('data.companyAddress', null);

        $this->actingAs($pending)->putJson('/api/v1/customer/profile/company', ['countryCode' => 'sg', 'companyAddress' => '1 Harbour Road'])
            ->assertOk()->assertJsonPath('data.countryCode', 'SG')->assertJsonPath('data.companyAddress', '1 Harbour Road');

        $this->app['auth']->forgetGuards();
        $active = $this->customer();
        $active->profile()->create(['company' => 'PT Aktif', 'country_code' => 'ID', 'company_address' => 'Jl. Lama 1']);
        // Nilai sama diabaikan, nilai berbeda ditolak; field lain tetap bisa diubah.
        $this->actingAs($active)->putJson('/api/v1/customer/profile/company', ['company' => 'PT Aktif Jaya', 'countryCode' => 'ID', 'companyAddress' => 'Jl. Lama 1'])
            ->assertOk()->assertJsonPath('data.company', 'PT Aktif Jaya');
        $this->actingAs($active)->putJson('/api/v1/customer/profile/company', ['countryCode' => 'MY'])
            ->assertStatus(422)->assertJsonValidationErrors(['countryCode']);
        $this->actingAs($active)->putJson('/api/v1/customer/profile/company', ['companyAddress' => 'Jl. Baru 2'])
            ->assertStatus(422)->assertJsonValidationErrors(['companyAddress']);
        $this->assertDatabaseHas('customer_profiles', ['user_id' => $active->id, 'country_code' => 'ID', 'company_address' => 'Jl. Lama 1']);
    }

    public function test_admin_locks_market_when_approving_and_resources_expose_it(): void
    {
        Mail::fake();
        $pending = $this->customer(['status' => User::STATUS_PENDING, 'email' => 'export@contoh.example']);
        $pending->profile()->create(['company' => 'Export Co', 'country_code' => 'MY', 'company_address' => 'Johor']);
        $admin = $this->adminWith(['customers']);

        $this->actingAs($admin)->putJson("/api/v1/admin/customers/{$pending->id}/status", ['status' => 'active', 'market' => 'ekspor'])
            ->assertStatus(422)->assertJsonValidationErrors(['market']);

        $this->actingAs($admin)->putJson("/api/v1/admin/customers/{$pending->id}/status", ['status' => 'active', 'market' => 'export'])
            ->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.market', 'export')->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.countryCode', 'MY')->assertJsonPath('data.companyAddress', 'Johor')->assertJsonPath('data.openOrdersCount', 0);
        Mail::assertQueued(AccountApproved::class);
        $this->assertSame('export', $pending->fresh()->market());

        $this->actingAs($admin)->getJson('/api/v1/admin/customers?market=export')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.market', 'export')->assertJsonPath('data.0.countryCode', 'MY');
        $this->customer(['email' => 'lokal@contoh.co.id']); // tanpa profil = lokal
        $this->actingAs($admin)->getJson('/api/v1/admin/customers?market=local')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.market', 'local');

        // /auth/me dan /customer/profile ikut membawa pasar + mata uang.
        $this->app['auth']->forgetGuards();
        $this->actingAs($pending->fresh())->fromFrontend()->getJson('/api/v1/auth/me')->assertOk()
            ->assertJsonPath('data.user.market', 'export')->assertJsonPath('data.user.currency', 'USD')->assertJsonPath('data.user.profile.countryCode', 'MY');
    }

    public function test_market_change_is_blocked_while_customer_has_open_orders(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct(['price' => 100000], 10);
        $order = $this->placeOrder($product, 1); // pending_payment = masih berjalan
        $admin = $this->adminWith(['customers']);

        $this->actingAs($admin)->putJson("/api/v1/admin/customers/{$this->buyer->id}/market", ['market' => 'export'])
            ->assertStatus(409)->assertJsonPath('code', 'CUSTOMER_HAS_OPEN_ORDERS')->assertJsonPath('meta.openOrders', 1);
        $this->assertSame('local', $this->buyer->fresh()->market());

        // Pasar yang sama tidak dianggap perubahan.
        $this->actingAs($admin)->putJson("/api/v1/admin/customers/{$this->buyer->id}/market", ['market' => 'local'])->assertOk()->assertJsonPath('data.market', 'local');

        app(OrderStateMachine::class)->transition($order, Order::STATUS_CANCELLED, $this->buyer, ['reason' => 'batal']);
        $this->actingAs($admin)->putJson("/api/v1/admin/customers/{$this->buyer->id}/market", ['market' => 'export'])
            ->assertOk()->assertJsonPath('data.market', 'export')->assertJsonPath('data.currency', 'USD');
        $this->assertDatabaseHas('customer_profiles', ['user_id' => $this->buyer->id, 'market' => CustomerProfile::MARKET_EXPORT]);

        $this->actingAs($admin)->putJson("/api/v1/admin/customers/{$this->buyer->id}/market", ['market' => 'lain'])->assertStatus(422);
        $this->actingAs($admin)->putJson("/api/v1/admin/customers/{$admin->id}/market", ['market' => 'export'])->assertStatus(404);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['orders']))->putJson("/api/v1/admin/customers/{$this->buyer->id}/market", ['market' => 'local'])->assertStatus(403);
    }

    public function test_market_change_and_checkout_lock_the_customer_row_and_checkout_reads_the_current_market(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $this->setUpExport();
        $product = $this->makeProduct(['price' => 100000], 10);
        $admin = $this->adminWith(['customers']);
        $this->buyer->load('profile'); // instance basi: pasar local tersimpan di relasi yang sudah dimuat

        $sql = [];
        DB::listen(function ($query) use (&$sql) {
            $sql[] = strtolower($query->sql);
        });
        $lockedUsers = function () use (&$sql) {
            return collect($sql)->contains(fn ($s) => str_contains($s, 'for update') && str_contains($s, '"users"'));
        };

        $this->actingAs($admin)->putJson("/api/v1/admin/customers/{$this->buyer->id}/market", ['market' => 'export'])->assertOk();
        $this->assertTrue($lockedUsers(), 'market change must lock the user row');
        $this->assertSame('local', $this->buyer->market()); // relasi di memori masih basi

        // Checkout dengan instance basi membaca pasar terkini di bawah kunci: order tidak dibuat dalam rupiah.
        $sql = [];
        try {
            $this->placeOrder($product, 1);
            $this->fail('checkout must use the current (export) market');
        } catch (ValidationException $e) {
            $this->assertNotEmpty($e->errors());
        }
        $this->assertTrue($lockedUsers(), 'checkout must lock the user row');
        $this->assertSame(0, Order::where('user_id', $this->buyer->id)->count());
    }
}
