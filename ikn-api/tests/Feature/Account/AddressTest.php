<?php

namespace Tests\Feature\Account;

use App\Models\CustomerAddress;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsRegions;
use Tests\TestCase;

class AddressTest extends TestCase
{
    use RefreshDatabase, SeedsRegions;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRegions();
        $this->user = $this->customer(['email' => 'buyer@example.com']);
    }

    public function test_first_address_is_default_and_response_matches_contract(): void
    {
        $response = $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->jakartaAddress())
            ->assertCreated()
            ->assertJsonPath('data.label', 'Gudang Utama Jakarta')
            ->assertJsonPath('data.recipientName', 'Budi Santoso / Gudang')
            ->assertJsonPath('data.addressLine', 'Jl. Industri Raya No. 45, Kawasan Industri Pulogadung')
            ->assertJsonPath('data.provinceCode', '31')
            ->assertJsonPath('data.regencyCode', '31.75')
            ->assertJsonPath('data.districtCode', '31.75.06')
            ->assertJsonPath('data.villageCode', '31.75.06.1007')
            ->assertJsonPath('data.region.province', 'Daerah Khusus Ibukota Jakarta')
            ->assertJsonPath('data.region.regency', 'Kota Administrasi Jakarta Timur')
            ->assertJsonPath('data.region.district', 'Cakung')
            ->assertJsonPath('data.region.village', 'Cakung Barat')
            ->assertJsonPath('data.postalCode', '13910')
            ->assertJsonPath('data.lat', -6.1834)
            ->assertJsonPath('data.lng', 106.9118)
            ->assertJsonPath('data.note', 'Masuk dari gerbang 2')
            ->assertJsonPath('data.isDefault', true);

        $this->assertIsFloat($response->json('data.lat'));

        // Alamat kedua tanpa isDefault → bukan default; dengan isDefault=true → mengambil alih default.
        $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->medanAddress())
            ->assertCreated()
            ->assertJsonPath('data.isDefault', false);

        $third = $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->medanAddress(['label' => 'Cabang Medan 2', 'isDefault' => true]))
            ->assertCreated()
            ->assertJsonPath('data.isDefault', true)
            ->json('data.id');

        $this->assertSame(1, CustomerAddress::where('user_id', $this->user->id)->default()->count());
        $this->assertSame($third, CustomerAddress::where('user_id', $this->user->id)->default()->value('id'));

        // Daftar: default selalu pertama.
        $this->actingAs($this->user)->getJson('/api/v1/customer/addresses')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.id', $third)
            ->assertJsonPath('data.0.isDefault', true);

        // Snapshot untuk order (BE-3): tanpa id/isDefault, region berisi nama.
        $snapshot = CustomerAddress::find($third)->toSnapshot();
        $this->assertArrayNotHasKey('id', $snapshot);
        $this->assertArrayNotHasKey('isDefault', $snapshot);
        $this->assertSame('Mabar', $snapshot['region']['village']);
        $this->assertSame(3.6713, $snapshot['lat']);
    }

    public function test_inconsistent_region_chain_is_rejected(): void
    {
        // Desa Medan di bawah kecamatan Jakarta.
        $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->jakartaAddress(['villageCode' => '12.71.06.1005']))
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR')
            ->assertJsonValidationErrors(['villageCode'])
            ->assertJsonMissingValidationErrors(['districtCode']);

        // Kecamatan Jakarta di bawah kota Medan.
        $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->medanAddress(['districtCode' => '31.75.06']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['districtCode']);

        // Level salah: provinceCode diisi kode kabupaten.
        $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->jakartaAddress(['provinceCode' => '31.75']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['provinceCode']);

        // Kode tidak dikenal.
        $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->jakartaAddress(['regencyCode' => '31.99']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['regencyCode']);

        // Format kode salah + lat di luar jangkauan.
        $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->jakartaAddress(['villageCode' => 'abc', 'lat' => 120]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['villageCode', 'lat']);

        $this->assertSame(0, CustomerAddress::count());
    }

    public function test_update_primary_and_delete_keep_single_default(): void
    {
        $first = $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->jakartaAddress())->json('data.id');
        $second = $this->actingAs($this->user)->postJson('/api/v1/customer/addresses', $this->medanAddress())->json('data.id');

        // Update isi + pindah default lewat isDefault.
        $this->actingAs($this->user)->putJson("/api/v1/customer/addresses/{$second}", $this->medanAddress(['label' => 'Cabang Medan (baru)', 'isDefault' => true]))
            ->assertOk()
            ->assertJsonPath('data.label', 'Cabang Medan (baru)')
            ->assertJsonPath('data.isDefault', true);
        $this->assertFalse(CustomerAddress::find($first)->is_default);

        // isDefault=false pada alamat default diabaikan.
        $this->actingAs($this->user)->putJson("/api/v1/customer/addresses/{$second}", $this->medanAddress(['isDefault' => false]))
            ->assertOk()
            ->assertJsonPath('data.isDefault', true);

        // Jadikan default lewat /primary.
        $this->actingAs($this->user)->putJson("/api/v1/customer/addresses/{$first}/primary")
            ->assertOk()
            ->assertJsonPath('data.isDefault', true);
        $this->assertFalse(CustomerAddress::find($second)->is_default);
        $this->assertSame(1, CustomerAddress::where('user_id', $this->user->id)->default()->count());

        // Hapus alamat default → default pindah ke alamat tersisa.
        $this->actingAs($this->user)->deleteJson("/api/v1/customer/addresses/{$first}")
            ->assertOk()
            ->assertJsonPath('data.deleted', true);
        $this->assertDatabaseMissing('customer_addresses', ['id' => $first]);
        $this->assertTrue(CustomerAddress::find($second)->is_default);

        $this->actingAs($this->user)->deleteJson("/api/v1/customer/addresses/{$second}")->assertOk();
        $this->assertSame(0, CustomerAddress::count());
    }

    public function test_address_of_another_user_is_not_found(): void
    {
        $other = $this->customer(['email' => 'lain@example.com']);
        $foreign = $this->actingAs($other)->postJson('/api/v1/customer/addresses', $this->jakartaAddress())->json('data.id');

        $this->app['auth']->forgetGuards();

        $this->actingAs($this->user)->putJson("/api/v1/customer/addresses/{$foreign}", $this->jakartaAddress())
            ->assertStatus(404)
            ->assertJsonPath('code', 'NOT_FOUND');
        $this->actingAs($this->user)->putJson("/api/v1/customer/addresses/{$foreign}/primary")->assertStatus(404);
        $this->actingAs($this->user)->deleteJson("/api/v1/customer/addresses/{$foreign}")->assertStatus(404);
        $this->actingAs($this->user)->getJson('/api/v1/customer/addresses')->assertOk()->assertJsonCount(0, 'data');

        $this->assertDatabaseHas('customer_addresses', ['id' => $foreign, 'user_id' => $other->id, 'is_default' => true]);
    }
}
