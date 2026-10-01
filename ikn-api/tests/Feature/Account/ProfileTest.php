<?php

namespace Tests\Feature\Account;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\SeedsRegions;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase, SeedsRegions;

    public function test_show_and_update_profile_and_company(): void
    {
        $this->seedRegions();
        $user = $this->customer(['name' => 'Budi Santoso', 'email' => 'buyer@example.com']);
        $user->profile()->create(['company' => 'Coating Solutions Co.', 'phone' => '0812', 'tax_id' => '01.234']);
        $user->addresses()->create(['is_default' => true] + $this->snakeAddress($this->jakartaAddress()));

        $this->actingAs($user)->getJson('/api/v1/customer/profile')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.name', 'Budi Santoso')
            ->assertJsonPath('data.email', 'buyer@example.com')
            ->assertJsonPath('data.status', User::STATUS_ACTIVE)
            ->assertJsonPath('data.company', 'Coating Solutions Co.')
            ->assertJsonPath('data.phone', '0812')
            ->assertJsonPath('data.taxId', '01.234')
            ->assertJsonPath('data.companyEmail', null)
            ->assertJsonCount(1, 'data.addresses')
            ->assertJsonPath('data.addresses.0.isDefault', true)
            ->assertJsonPath('data.addresses.0.region.village', 'Cakung Barat');

        $this->actingAs($user)->putJson('/api/v1/customer/profile', ['name' => 'Budi S.', 'phone' => '089912345678', 'position' => 'Manager'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Budi S.')
            ->assertJsonPath('data.phone', '089912345678')
            ->assertJsonPath('data.position', 'Manager')
            ->assertJsonPath('data.company', 'Coating Solutions Co.')
            ->assertJsonStructure(['message']);

        $this->actingAs($user)->putJson('/api/v1/customer/profile/company', [
            'company' => 'Coating Solutions Indonesia', 'companyEmail' => 'Sales@Example.com', 'companyPhone' => '021555', 'taxId' => '99.999',
        ])->assertOk()
            ->assertJsonPath('data.company', 'Coating Solutions Indonesia')
            ->assertJsonPath('data.companyEmail', 'sales@example.com')
            ->assertJsonPath('data.companyPhone', '021555')
            ->assertJsonPath('data.taxId', '99.999');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Budi S.']);
        $this->assertDatabaseHas('customer_profiles', ['user_id' => $user->id, 'company' => 'Coating Solutions Indonesia', 'company_email' => 'sales@example.com', 'phone' => '089912345678']);

        $this->actingAs($user)->putJson('/api/v1/customer/profile/company', ['companyEmail' => 'bukan-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['companyEmail']);
    }

    public function test_profile_row_is_created_lazily_for_customer_without_profile(): void
    {
        $user = $this->customer();
        $this->assertDatabaseMissing('customer_profiles', ['user_id' => $user->id]);

        $this->actingAs($user)->getJson('/api/v1/customer/profile')
            ->assertOk()
            ->assertJsonPath('data.company', null)
            ->assertJsonPath('data.addresses', []);

        $this->assertDatabaseHas('customer_profiles', ['user_id' => $user->id]);
    }

    public function test_change_password_requires_current_password_and_policy(): void
    {
        $user = $this->customer(['email' => 'buyer@example.com']);

        $this->actingAs($user)->putJson('/api/v1/customer/profile/password', [
            'currentPassword' => 'salah', 'password' => 'BaruAman123', 'passwordConfirmation' => 'BaruAman123',
        ])->assertStatus(422)->assertJsonValidationErrors(['currentPassword']);

        $this->actingAs($user)->putJson('/api/v1/customer/profile/password', [
            'currentPassword' => 'password', 'password' => 'lemah', 'passwordConfirmation' => 'lemah',
        ])->assertStatus(422)->assertJsonValidationErrors(['password']);

        $this->actingAs($user)->putJson('/api/v1/customer/profile/password', [
            'currentPassword' => 'password', 'password' => 'BaruAman123', 'passwordConfirmation' => 'BaruAman123',
        ])->assertOk()->assertJsonPath('data.ok', true);

        $this->assertTrue(Hash::check('BaruAman123', $user->fresh()->password));
    }

    public function test_admin_cannot_use_customer_profile_endpoints(): void
    {
        $admin = $this->adminWith(['customers']);

        $this->actingAs($admin)->getJson('/api/v1/customer/profile')->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
        $this->getJson('/api/v1/customer/profile', ['Authorization' => ''])->assertStatus(403);

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/customer/addresses')->assertStatus(401)->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    /** camelCase payload → kolom snake_case untuk membuat alamat langsung lewat model. */
    private function snakeAddress(array $payload): array
    {
        return [
            'label' => $payload['label'],
            'recipient_name' => $payload['recipientName'],
            'phone' => $payload['phone'],
            'address_line' => $payload['addressLine'],
            'province_code' => $payload['provinceCode'],
            'regency_code' => $payload['regencyCode'],
            'district_code' => $payload['districtCode'],
            'village_code' => $payload['villageCode'],
            'postal_code' => $payload['postalCode'],
            'lat' => $payload['lat'],
            'lng' => $payload['lng'],
            'note' => $payload['note'],
        ];
    }
}
