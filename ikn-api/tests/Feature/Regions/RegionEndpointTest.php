<?php

namespace Tests\Feature\Regions;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsRegions;
use Tests\TestCase;

class RegionEndpointTest extends TestCase
{
    use RefreshDatabase, SeedsRegions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRegions();
    }

    public function test_index_defaults_to_provinces_and_filters_by_level(): void
    {
        $this->getJson('/api/v1/regions')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.code', '31')
            ->assertJsonPath('data.0.level', 'province')
            ->assertJsonPath('data.0.parentCode', null)
            ->assertJsonPath('data.1.name', 'Sumatera Utara');

        $this->getJson('/api/v1/regions?level=regency')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.code', '31.75');

        $this->getJson('/api/v1/regions?level=bogus')->assertStatus(422)->assertJsonPath('code', 'VALIDATION_ERROR');
    }

    public function test_index_lists_children_of_parent_code(): void
    {
        $this->getJson('/api/v1/regions?parent=31.75')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Cakung')
            ->assertJsonPath('data.0.parentCode', '31.75')
            ->assertJsonPath('data.1.name', 'Jatinegara');

        $this->getJson('/api/v1/regions?parent=31.75.06')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.level', 'village');

        $this->getJson('/api/v1/regions?parent=99.99')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_search_is_case_insensitive_and_includes_parent_path(): void
    {
        $response = $this->getJson('/api/v1/regions/search?q=CAKUNG')->assertOk()->assertJsonCount(3, 'data');

        $district = collect($response->json('data'))->firstWhere('code', '31.75.06');
        $this->assertSame('district', $district['level']);
        $this->assertSame(['Daerah Khusus Ibukota Jakarta', 'Kota Administrasi Jakarta Timur'], $district['path']);
        $this->assertSame('Cakung, Kota Administrasi Jakarta Timur, Daerah Khusus Ibukota Jakarta', $district['fullName']);

        $this->getJson('/api/v1/regions/search?q=cakung&level=village')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/regions/search?q=c')->assertStatus(422);
        $this->getJson('/api/v1/regions/search')->assertStatus(422);
    }
}
