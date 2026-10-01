<?php

use App\Http\Controllers\Api\V1\Customer\DashboardController;
use App\Http\Controllers\Api\V1\Customer\OrderController;
use App\Http\Controllers\Api\V1\Customer\OrderPaymentController;
use App\Http\Controllers\Api\V1\Customer\VoucherController;
use App\Http\Controllers\Api\V1\PaymentWebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Order & pembayaran customer + webhook gateway (BE-3)
|--------------------------------------------------------------------------
| Dimuat otomatis oleh RouteServiceProvider dengan prefix api/v1 + middleware api.
| Kontrak: plan/02-api-contract.md bagian 9 (order customer) dan 10 (pembayaran, webhook).
| {order:number} = route-model binding dengan nomor order; order bukan milik user → 404.
*/

Route::prefix('customer')->middleware(['auth:sanctum', 'role:customer'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'show']);
    Route::get('vouchers', [VoucherController::class, 'index']); // voucher khusus customer ini (ASUMSI A-67)

    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store'])->middleware('customer.active');
    Route::get('orders/{order:number}', [OrderController::class, 'show']);
    Route::post('orders/{order:number}/cancel', [OrderController::class, 'cancel']);
    Route::post('orders/{order:number}/confirm-received', [OrderController::class, 'confirmReceived']);
    Route::post('orders/{order:number}/complete', [OrderController::class, 'complete']);
    Route::post('orders/{order:number}/reviews', [OrderController::class, 'reviews']);

    Route::get('orders/{order:number}/payments', [OrderPaymentController::class, 'index']);
    Route::post('orders/{order:number}/payments', [OrderPaymentController::class, 'store']);
    Route::post('orders/{order:number}/proof', [OrderPaymentController::class, 'proof']);
});

// Webhook gateway: publik, verifikasi token per provider di driver; tanpa CSRF (bukan request stateful Sanctum).
Route::post('payments/webhook/{provider}', [PaymentWebhookController::class, 'handle'])
    ->where('provider', '[a-z_]+')
    ->name('payments.webhook');
