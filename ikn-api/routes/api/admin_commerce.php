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
            // Catatan perjalanan kiriman selama status shipped (ASUMSI A-70).
            Route::post('orders/{order:number}/tracking', [Admin\OrderTrackingController::class, 'store']);
            Route::delete('orders/{order:number}/tracking/{update}', [Admin\OrderTrackingController::class, 'destroy'])->where('update', '[0-9]+');
            // Lampiran order (faktur pajak, surat jalan) di disk private (ASUMSI A-74).
            Route::post('orders/{order:number}/attachments', [Admin\OrderAttachmentController::class, 'store']);
            Route::delete('orders/{order:number}/attachments/{attachment}', [Admin\OrderAttachmentController::class, 'destroy'])->where('attachment', '[0-9]+');
            // Proforma invoice yang bisa diedit admin, nomor tetap + revisi (ASUMSI A-88, kontrak 11.11).
            Route::put('orders/{order:number}/proforma', [Admin\OrderProformaController::class, 'update']);
            // Penawaran ongkir CIF per putaran (ASUMSI A-89, kontrak 11.12).
            Route::post('orders/{order:number}/freight-quotes', [Admin\FreightQuoteController::class, 'store']);
            Route::put('orders/{order:number}/freight-quotes/{quote}/extend', [Admin\FreightQuoteController::class, 'extend'])->where('quote', '[0-9]+');
            Route::post('orders/{order:number}/freight-quotes/{quote}/accept', [Admin\FreightQuoteController::class, 'accept'])->where('quote', '[0-9]+');
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
            // Kurs JISDOR untuk keuangan (kontrak 11.7, ASUMSI A-84); POST = kurs manual cadangan.
            Route::get('exchange-rates', [Admin\ExchangeRateController::class, 'index']);
            Route::post('exchange-rates', [Admin\ExchangeRateController::class, 'store']);
        });

        Route::middleware('role:super_admin')->group(function () {
            Route::get('audit-logs', [Admin\AuditLogController::class, 'index']);
        });
    });
