<?php

use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Customer\ChatController;
use App\Http\Controllers\Api\V1\Customer\NotificationController;
use App\Http\Controllers\Api\V1\PublicSite\GuestChatController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Notifikasi dalam aplikasi, live chat, badge (ASUMSI A-71, A-73)
|--------------------------------------------------------------------------
| Dimuat otomatis oleh RouteServiceProvider dengan prefix api/v1 + middleware api.
| Kontrak: plan/02-api-contract.md bagian 12 (notifikasi & chat).
*/

Route::prefix('customer')->middleware(['auth:sanctum', 'role:customer'])->group(function () {
    Route::get('badges', [NotificationController::class, 'badges']);
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
    Route::post('notifications/{id}/read', [NotificationController::class, 'read'])->where('id', '[0-9]+');

    Route::get('chat', [ChatController::class, 'show']);
    Route::post('chat/messages', [ChatController::class, 'send'])->middleware('throttle:30,1');
    Route::post('chat/read', [ChatController::class, 'read']);
    Route::post('chat/claim', [ChatController::class, 'claim']); // ambil alih percakapan tamu setelah login
});

// Tamu (belum login): identitas dari formulir, percakapan dikenali lewat token acak di browser.
Route::prefix('chat/guest')->group(function () {
    Route::post('/', [GuestChatController::class, 'start'])->middleware('throttle:10,60');
    Route::get('/', [GuestChatController::class, 'show']);
    Route::post('messages', [GuestChatController::class, 'send'])->middleware('throttle:30,1');
    Route::post('read', [GuestChatController::class, 'read']);
});

// Admin: tanpa middleware audit (pesan chat adalah catatannya sendiri; badge hanya baca).
Route::prefix('admin')->middleware(['auth:sanctum', 'role:admin,super_admin'])->group(function () {
    Route::get('badges', [Admin\BadgeController::class, 'show']);

    Route::middleware('module:chat')->group(function () {
        Route::get('chats', [Admin\ChatController::class, 'index']);
        Route::post('chats', [Admin\ChatController::class, 'open']);
        Route::get('chats/{conversation}', [Admin\ChatController::class, 'show'])->where('conversation', '[0-9]+');
        Route::post('chats/{conversation}/messages', [Admin\ChatController::class, 'send'])->where('conversation', '[0-9]+');
        Route::post('chats/{conversation}/read', [Admin\ChatController::class, 'read'])->where('conversation', '[0-9]+');
    });
});
