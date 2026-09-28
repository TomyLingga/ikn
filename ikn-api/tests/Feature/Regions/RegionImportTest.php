<?php

namespace Tests\Feature\Regions;

use App\Models\Region;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegionImportTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): string
    {
        return base_path('tests/fixtures/regions_subset.csv');
    }

    public function test_import_builds_four_chained_levels_and_is_idempotent(): void
    {
        $this->artisan('regions:import', ['--file' => $this->fixture(), '--chunk' => 4])->assertExitCode(0);

        // 13 baris fixture: 1 tidak valid (dilewati) + 1 duplikat kode → 11 wilayah unik.
        $this->assertSame(11, Region::count());
        $this->assertNull(Region::find('abc'));

        $province = Region::findOrFail('31');
        $regency = Region::findOrFail('31.75');
        $district = Region::findOrFail('31.75.06');
        $village = Region::findOrFail('31.75.06.1007');

        $this->assertSame(Region::LEVEL_PROVINCE, $province->level);
        $this->assertNull($province->parent_code);
        $this->assertSame(Region::LEVEL_REGENCY, $regency->level);
        $this->assertSame('31', $regency->parent_code);
        $this->assertSame(Region::LEVEL_DISTRICT, $district->level);
        $this->assertSame('31.75', $district->parent_code);
        $this->assertSame(Region::LEVEL_VILLAGE, $village->level);
        $this->assertSame('31.75.06', $village->parent_code);
        $this->assertSame('Cakung Barat', $village->name);

        $this->assertSame(
            ['Daerah Khusus Ibukota Jakarta', 'Kota Administrasi Jakarta Timur', 'Cakung'],
            $village->pathNames()
        );
        $this->assertSame(2, $regency->children()->count());

        // Idempoten: impor kedua tidak menggandakan baris dan memperbarui nama yang berubah.
        Region::where('code', '31.75.06')->update(['name' => 'Nama Lama']);
        $this->artisan('regions:import', ['--file' => $this->fixture()])->assertExitCode(0);
        $this->assertSame(11, Region::count());
        $this->assertSame('Cakung', Region::findOrFail('31.75.06')->name);
    }

    public function test_import_fails_when_file_is_missing(): void
    {
        $this->artisan('regions:import', ['--file' => base_path('tests/fixtures/tidak-ada.csv')])->assertExitCode(1);
        $this->assertSame(0, Region::count());
    }

    public function test_code_helpers_derive_level_and_parent(): void
    {
        $this->assertSame(Region::LEVEL_PROVINCE, Region::levelForCode('11'));
        $this->assertSame(Region::LEVEL_REGENCY, Region::levelForCode('11.01'));
        $this->assertSame(Region::LEVEL_DISTRICT, Region::levelForCode('11.01.01'));
        $this->assertSame(Region::LEVEL_VILLAGE, Region::levelForCode('11.01.01.2001'));
        $this->assertNull(Region::levelForCode('11.01.01.2001.1'));
        $this->assertNull(Region::levelForCode('abc'));

        $this->assertNull(Region::parentCodeFor('11'));
        $this->assertSame('11.01.01', Region::parentCodeFor('11.01.01.2001'));
        $this->assertSame(['11', '11.01', '11.01.01'], Region::ancestorCodes('11.01.01.2001'));
    }
}
