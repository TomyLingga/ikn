<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Tema warna (A-91): tiga kunci biru lama (theme.primary, theme.primary_deep, theme.accent) diganti satu set per mode
// (theme.light_* dan theme.dark_*). Baris lama dihapus agar tidak tertinggal; kunci baru memakai bawaan SettingsService.
class ReplaceThemeSettingsWithModePalettes extends Migration
{
    private const LEGACY = ['theme.primary', 'theme.primary_deep', 'theme.accent'];

    public function up(): void
    {
        DB::table('settings')->whereIn('key', self::LEGACY)->delete();
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'like', 'theme.light_%')->orWhere('key', 'like', 'theme.dark_%')->delete();
    }
}
