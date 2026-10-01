<?php

use App\Http\Controllers\Api\V1\Admin;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Admin katalog & konfigurasi commerce (BE-2)
|--------------------------------------------------------------------------
| Kontrak: plan/02-api-contract.md bagian 11.3 (katalog, stok, ulasan) dan 11.5 (bank, fee, ongkir, voucher,
| metode bayar, settings). Semua aksi tulis dicatat middleware audit.
*/

Route::prefix('admin')
    ->middleware(['auth:sanctum', 'role:admin,super_admin', 'audit'])
    ->group(function () {
        Route::middleware('module:categories')->group(function () {
            Route::get('categories', [Admin\CategoryController::class, 'index']);
            Route::post('categories', [Admin\CategoryController::class, 'store']);
            Route::put('categories/{category}', [Admin\CategoryController::class, 'update']);
            Route::delete('categories/{category}', [Admin\CategoryController::class, 'destroy']);
        });

        Route::middleware('module:products')->group(function () {
            Route::get('products', [Admin\ProductController::class, 'index']);
            Route::post('products', [Admin\ProductController::class, 'store']);
            Route::get('products/{product}', [Admin\ProductController::class, 'show']);
            Route::put('products/{product}', [Admin\ProductController::class, 'update']);
            Route::delete('products/{product}', [Admin\ProductController::class, 'destroy']);
            Route::put('products/{product}/publish', [Admin\ProductController::class, 'publish']);
            Route::get('reviews', [Admin\ReviewController::class, 'index']);
            Route::put('reviews/{review}', [Admin\ReviewController::class, 'update']);
        });

        Route::middleware('module:stock')->group(function () {
            Route::get('products/{product}/stock', [Admin\StockController::class, 'show']);
            Route::post('products/{product}/stock', [Admin\StockController::class, 'store']);
        });

        Route::middleware('module:bank_accounts')->group(function () {
            Route::apiResource('bank-accounts', Admin\BankAccountController::class)->except('show')->parameters(['bank-accounts' => 'bankAccount']);
        });

        Route::middleware('module:fees')->group(function () {
            Route::apiResource('fees', Admin\FeeController::class)->except('show');
        });

        Route::middleware('module:shipping')->group(function () {
            Route::get('shipping-methods', [Admin\ShippingRateController::class, 'methods']); // alias kompatibilitas FE lama
            Route::apiResource('shipping-zones', Admin\ShippingZoneController::class)->parameters(['shipping-zones' => 'shippingZone']);
            Route::get('shipping-zones/{shippingZone}/rates', [Admin\ShippingRateController::class, 'index']);
            Route::post('shipping-zones/{shippingZone}/rates', [Admin\ShippingRateController::class, 'store']);
            Route::put('shipping-rates/{shippingRate}', [Admin\ShippingRateController::class, 'update']);
            Route::delete('shipping-rates/{shippingRate}', [Admin\ShippingRateController::class, 'destroy']);
            Route::get('shipping-origin', [Admin\ShippingOriginController::class, 'show']);
            Route::put('shipping-origin', [Admin\ShippingOriginController::class, 'update']);
        });

        Route::middleware('module:vouchers')->group(function () {
            Route::apiResource('vouchers', Admin\VoucherController::class);
        });

        Route::middleware('module:payment_methods')->group(function () {
            Route::get('payment-methods', [Admin\PaymentMethodController::class, 'index']);
            Route::post('payment-methods', [Admin\PaymentMethodController::class, 'store']);
            Route::get('payment-methods/{paymentMethod}', [Admin\PaymentMethodController::class, 'show']);
            Route::put('payment-methods/{paymentMethod}', [Admin\PaymentMethodController::class, 'update']);
        });

        Route::middleware('module:settings')->group(function () {
            Route::get('settings', [Admin\CommerceSettingController::class, 'index']);
            Route::put('settings', [Admin\CommerceSettingController::class, 'update']);
        });
    });
