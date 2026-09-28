<?php

use App\Http\Controllers\Api\V1\Admin;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Admin order, pembayaran, dashboard, laporan, audit log (BE-3)
|--------------------------------------------------------------------------
| Kontrak: plan/02-api-contract.md bagian 11.1 (dashboard, reports, audit-logs) dan 11.2 (orders, payments).
| Semua aksi tulis dicatat middleware audit.
*/

Route::prefix('admin')
    ->middleware(['auth:sanctum', 'role:admin,super_admin', 'audit'])
    ->group(function () {
        Route::middleware('module:orders')->group(function () {
            Route::get('orders', [Admin\OrderController::class, 'index']);
            Route::get('orders/{order:number}', [Admin\OrderController::class, 'show']);
            Route::post('orders/{order:number}/status', [Admin\OrderController::class, 'updateStatus']);
            Route::post('orders/{order:number}/cancel', [Admin\OrderController::class, 'cancel']);
            Route::put('orders/{order:number}/due', [Admin\OrderController::class, 'updateDue']);
        });

        Route::middleware('module:payments')->group(function () {
            Route::get('payments', [Admin\PaymentController::class, 'index']);
            Route::get('payments/{payment}', [Admin\PaymentController::class, 'show'])->where('payment', '[0-9]+');
            Route::post('payments/{payment}/accept', [Admin\PaymentController::class, 'accept'])->where('payment', '[0-9]+');
            Route::post('payments/{payment}/reject', [Admin\PaymentController::class, 'reject'])->where('payment', '[0-9]+');
            // Alias kompatibilitas FE lama (by nomor order): accept/reject payment aktif.
            Route::post('orders/{order:number}/payments/accept', [Admin\PaymentController::class, 'acceptByOrder']);
            Route::post('orders/{order:number}/payments/reject', [Admin\PaymentController::class, 'rejectByOrder']);
        });

        Route::middleware('module:dashboard')->group(function () {
            Route::get('dashboard', [Admin\DashboardController::class, 'show']);
        });

        Route::middleware('module:reports')->group(function () {
            Route::get('reports/sales', [Admin\SalesReportController::class, 'show']);
        });

        Route::middleware('role:super_admin')->group(function () {
            Route::get('audit-logs', [Admin\AuditLogController::class, 'index']);
        });
    });
