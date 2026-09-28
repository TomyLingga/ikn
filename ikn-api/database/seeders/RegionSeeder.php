<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

// Wilayah Kemendagri (regions): impor database/data/wilayah.csv.gz lewat regions:import (idempoten, ~91 ribu baris).
class RegionSeeder extends Seeder
{
    public function run(): void
    {
        Artisan::call('regions:import', [], $this->command ? $this->command->getOutput() : null);
    }
}
