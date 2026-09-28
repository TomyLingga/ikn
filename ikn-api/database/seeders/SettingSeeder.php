<?php

namespace Database\Seeders;

use App\Services\Cms\SettingsService;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(SettingsService $settings)
    {
        $settings->seedDefaults();
    }
}
