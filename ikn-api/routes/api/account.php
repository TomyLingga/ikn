<?php

use App\Http\Controllers\Api\V1\Admin\CustomerController as AdminCustomerController;
use App\Http\Controllers\Api\V1\Auth\PasswordController;
use App\Http\Controllers\Api\V1\Auth\RegistrationController;
use App\Http\Controllers\Api\V1\Customer\AddressController;
use App\Http\Controllers\Api\V1\Customer\ProfileController;
use App\Http\Controllers\Api\V1\GeoController;
use App\Http\Controllers\Api\V1\PublicSite\RegionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Akun & wilayah (BE-1) — dimuat otomatis dengan prefix /api/v1 + middleware api
|--------------------------------------------------------------------------
| Kontrak: plan/02-api-contract.md bagian 3 (register/verify/reset), 4 (profil, alamat), 5 (regions, geo), 11.4 (customers).
*/

// ---- Auth: registrasi, verifikasi email, reset kata sandi ----
Route::prefix('auth')->group(function () {
    Route::post('register', [RegistrationController::class, 'register'])->middleware('throttle:register');
    Route::get('verify-email/{id}/{hash}', [RegistrationController::class, 'verify'])
        ->middleware('signed')
        ->where(['id' => '[0-9]+', 'hash' => '[a-f0-9]{40}'])
        ->name('auth.verify-email');
    Route::post('verification/resend', [RegistrationController::class, 'resend'])->middleware('throttle:verification-resend');
    Route::post('password/forgot', [PasswordController::class, 'forgot'])->middleware('throttle:auth');
    Route::post('password/reset', [PasswordController::class, 'reset'])->middleware('throttle:auth');
});

// ---- Wilayah (publik) ----
Route::get('regions', [RegionController::class, 'index']);
Route::get('regions/search', [RegionController::class, 'search']);

// ---- Geo proxy Nominatim (login apa pun) ----
Route::prefix('geo')->middleware(['auth:sanctum', 'throttle:geo'])->group(function () {
    Route::get('search', [GeoController::class, 'search']);
    Route::get('reverse', [GeoController::class, 'reverse']);
});

// ---- Customer: profil & alamat (pending boleh; checkout dibatasi customer.active di BE-3) ----
Route::prefix('customer')->middleware(['auth:sanctum', 'role:customer'])->group(function () {
    Route::get('profile', [ProfileController::class, 'show']);
    Route::put('profile', [ProfileController::class, 'update']);
    Route::put('profile/company', [ProfileController::class, 'updateCompany']);
    Route::put('profile/password', [ProfileController::class, 'updatePassword']);

    Route::get('addresses', [AddressController::class, 'index']);
    Route::post('addresses', [AddressController::class, 'store']);
    Route::put('addresses/{id}', [AddressController::class, 'update'])->where('id', '[0-9]+');
    Route::put('addresses/{id}/primary', [AddressController::class, 'setPrimary'])->where('id', '[0-9]+');
    Route::delete('addresses/{id}', [AddressController::class, 'destroy'])->where('id', '[0-9]+');
});

// ---- Admin: customers (modul customers) ----
Route::prefix('admin')
    ->middleware(['auth:sanctum', 'role:admin,super_admin', 'audit'])
    ->group(function () {
        Route::middleware('module:customers')->group(function () {
            Route::get('customers', [AdminCustomerController::class, 'index']);
            Route::get('customers/{customer}', [AdminCustomerController::class, 'show']);
            Route::put('customers/{customer}/status', [AdminCustomerController::class, 'updateStatus']);
        });
    });
