<?php

namespace Tests\Feature\Account;

use App\Mail\Account\AccountApproved;
use App\Mail\Account\AccountRejected;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Support\SeedsRegions;
use Tests\TestCase;

class AdminCustomerTest extends TestCase
{
    use RefreshDatabase, SeedsRegions;

    private function makeCustomer(string $email, string $status, array $profile = []): User
    {
        $user = $this->customer(['email' => $email, 'status' => $status]);
        $user->profile()->create($profile);

        return $user;
    }

    public function test_index_filters_by_status_and_query_with_pagination(): void
    {
        $this->seedRegions();
        $active = $this->makeCustomer('buyer@coating.co.id', User::STATUS_ACTIVE, ['company' => 'Coating Solutions Co.', 'phone' => '0812']);
        $active->addresses()->create([
            'label' => 'Gudang', 'recipient_name' => 'Budi', 'phone' => '0812', 'address_line' => 'Jl. A',
            'province_code' => '31', 'regency_code' => '31.75', 'district_code' => '31.75.06', 'village_code' => '31.75.06.1007', 'is_default' => true,
        ]);
        $this->makeCustomer('pending@contoh.co.id', User::STATUS_PENDING, ['company' => 'PT Contoh']);
        $this->makeCustomer('ditolak@contoh.co.id', User::STATUS_REJECTED, ['company' => 'CV Tolak']);
        $this->adminWith(['customers'], ['email' => 'admin2@ptikn.com']); // admin lain tidak ikut daftar customer

        $admin = $this->adminWith(['customers']);

        $this->actingAs($admin)->getJson('/api/v1/admin/customers?perPage=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.perPage', 2)
            ->assertJsonPath('meta.lastPage', 2)
            ->assertJsonStructure(['data' => [['id', 'name', 'email', 'phone', 'company', 'status', 'joinedAt', 'approvedAt', 'rejectionReason', 'emailVerifiedAt', 'addressesCount']]]);

        $this->actingAs($admin)->getJson('/api/v1/admin/customers?status=pending')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.email', 'pending@contoh.co.id')
            ->assertJsonPath('data.0.company', 'PT Contoh')
            ->assertJsonPath('data.0.addressesCount', 0);

        $this->actingAs($admin)->getJson('/api/v1/admin/customers?q=COATING')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $active->id)
            ->assertJsonPath('data.0.addressesCount', 1);

        $this->actingAs($admin)->getJson('/api/v1/admin/customers?status=salah')->assertStatus(422);
    }

    public function test_admin_without_customers_module_is_forbidden_but_super_admin_is_allowed(): void
    {
        $customer = $this->makeCustomer('buyer@example.com', User::STATUS_PENDING);

        $this->actingAs($this->adminWith(['news']))->getJson('/api/v1/admin/customers')
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN');

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->superAdmin())->getJson('/api/v1/admin/customers/'.$customer->id)
            ->assertOk()
            ->assertJsonPath('data.id', $customer->id);

        $this->app['auth']->forgetGuards();
        $this->actingAs($customer)->getJson('/api/v1/admin/customers')->assertStatus(403);
    }

    public function test_show_includes_profile_addresses_and_orders_placeholder(): void
    {
        $this->seedRegions();
        $customer = $this->makeCustomer('buyer@example.com', User::STATUS_ACTIVE, ['company' => 'PT Uji', 'tax_id' => '01.1', 'company_email' => 'x@uji.id']);
        $customer->addresses()->create([
            'label' => 'Gudang', 'recipient_name' => 'Budi', 'phone' => '0812', 'address_line' => 'Jl. A',
            'province_code' => '12', 'regency_code' => '12.71', 'district_code' => '12.71.06', 'village_code' => '12.71.06.1005', 'is_default' => true,
        ]);
        $admin = $this->adminWith(['customers']);

        $this->actingAs($admin)->getJson('/api/v1/admin/customers/'.$customer->id)
            ->assertOk()
            ->assertJsonPath('data.company', 'PT Uji')
            ->assertJsonPath('data.taxId', '01.1')
            ->assertJsonPath('data.companyEmail', 'x@uji.id')
            ->assertJsonPath('data.addressesCount', 1)
            ->assertJsonPath('data.addresses.0.region.village', 'Mabar')
            ->assertJsonPath('data.addresses.0.isDefault', true)
            ->assertJsonPath('data.orders', [])
            ->assertJsonPath('data.ordersCount', 0)
            ->assertJsonPath('data.approvedBy', null);

        // Akun admin bukan customer → 404.
        $this->actingAs($admin)->getJson('/api/v1/admin/customers/'.$admin->id)->assertStatus(404)->assertJsonPath('code', 'NOT_FOUND');
        $this->actingAs($admin)->getJson('/api/v1/admin/customers/999999')->assertStatus(404);
    }

    public function test_reject_requires_reason_and_sends_mail(): void
    {
        Mail::fake();
        $customer = $this->makeCustomer('buyer@example.com', User::STATUS_PENDING);
        $admin = $this->adminWith(['customers']);

        $this->fromFrontend()->actingAs($admin)->putJson('/api/v1/admin/customers/'.$customer->id.'/status', ['status' => User::STATUS_REJECTED])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);
        Mail::assertNothingQueued();

        $this->fromFrontend()->actingAs($admin)->putJson('/api/v1/admin/customers/'.$customer->id.'/status', [
            'status' => User::STATUS_REJECTED, 'reason' => 'NPWP tidak valid',
        ])->assertOk()
            ->assertJsonPath('data.status', User::STATUS_REJECTED)
            ->assertJsonPath('data.rejectionReason', 'NPWP tidak valid')
            ->assertJsonPath('data.approvedAt', null)
            ->assertJsonStructure(['message']);

        Mail::assertQueued(AccountRejected::class, fn (AccountRejected $mail) => $mail->hasTo('buyer@example.com') && $mail->reason === 'NPWP tidak valid');
        Mail::assertNotQueued(AccountApproved::class);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'subject_type' => 'User', 'subject_id' => $customer->id]);

        // Ditolak lalu disetujui: email approve dikirim, alasan dibersihkan.
        $this->fromFrontend()->actingAs($admin)->putJson('/api/v1/admin/customers/'.$customer->id.'/status', ['status' => User::STATUS_ACTIVE])
            ->assertOk()
            ->assertJsonPath('data.status', User::STATUS_ACTIVE)
            ->assertJsonPath('data.rejectionReason', null)
            ->assertJsonPath('data.approvedBy.id', $admin->id);
        Mail::assertQueued(AccountApproved::class, 1);
    }

    public function test_inactive_sends_no_mail_and_pending_is_not_a_valid_target(): void
    {
        Mail::fake();
        $customer = $this->makeCustomer('buyer@example.com', User::STATUS_ACTIVE);
        $customer->forceFill(['approved_at' => now()])->save();
        $admin = $this->adminWith(['customers']);

        $this->fromFrontend()->actingAs($admin)->putJson('/api/v1/admin/customers/'.$customer->id.'/status', ['status' => User::STATUS_INACTIVE])
            ->assertOk()
            ->assertJsonPath('data.status', User::STATUS_INACTIVE);
        Mail::assertNothingQueued();
        $this->assertNotNull($customer->fresh()->approved_at);

        $this->fromFrontend()->actingAs($admin)->putJson('/api/v1/admin/customers/'.$customer->id.'/status', ['status' => User::STATUS_PENDING])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        // inactive → active = reaktivasi tanpa email.
        $this->fromFrontend()->actingAs($admin)->putJson('/api/v1/admin/customers/'.$customer->id.'/status', ['status' => User::STATUS_ACTIVE])
            ->assertOk()
            ->assertJsonPath('data.status', User::STATUS_ACTIVE);
        Mail::assertNothingQueued();
    }
}
