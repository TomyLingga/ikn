<?php

use App\Http\Controllers\Api\V1\Customer\CartQuoteController;
use App\Http\Controllers\Api\V1\PublicSite\CatalogController;
use App\Http\Controllers\Api\V1\PublicSite\CommerceConfigController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Katalog publik + konfigurasi commerce + cart/quote (BE-2)
|--------------------------------------------------------------------------
| Dimuat otomatis oleh RouteServiceProvider dengan prefix api/v1 + middleware api.
| Kontrak: plan/02-api-contract.md bagian 6, 9 (/commerce/config, /cart/quote), 10 (/payment-methods).
*/

Route::prefix('catalog')->group(function () {
    Route::get('categories', [CatalogController::class, 'categories']);
    Route::get('products', [CatalogController::class, 'products']);
    Route::get('products/{slug}', [CatalogController::class, 'product']);
    Route::get('products/{slug}/reviews', [CatalogController::class, 'reviews']);
});

Route::get('commerce/config', [CommerceConfigController::class, 'config']);
Route::get('payment-methods', [CommerceConfigController::class, 'paymentMethods']);

// Quote keranjang: customer login (belum harus disetujui; checkout yang memakai customer.active ada di area BE-3).
Route::post('cart/quote', [CartQuoteController::class, 'quote'])->middleware(['auth:sanctum', 'role:customer']);
