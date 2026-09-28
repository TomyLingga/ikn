<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

// API-only: tidak ada halaman Blade. /up = health check (DB), /storage/* = fallback bila symlink tidak ada.

Route::get('/', fn () => response()->json(['name' => config('app.name'), 'api' => url('/api/v1')]));

Route::get('/up', function () {
    DB::select('SELECT 1');

    return response()->json(['ok' => true, 'time' => now()->toIso8601String()]);
});

// Windows tanpa hak symlink: layani berkas disk public lewat route. Di produksi nginx melayani langsung.
Route::get('/storage/{path}', function (string $path) {
    $disk = Storage::disk('public');
    if (str_contains($path, '..') || ! $disk->exists($path)) {
        abort(404);
    }

    return response()->file($disk->path($path), ['Cache-Control' => 'public, max-age=86400']);
})->where('path', '.*');
