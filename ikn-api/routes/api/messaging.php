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
    // Edit/tarik pesan sendiri selama jendela edit (ASUMSI A-99). Tidak ada rute DELETE: chat tidak bisa dihapus.
    Route::put('chat/messages/{message}', [ChatController::class, 'update'])->where('message', '[0-9]+')->middleware('throttle:30,1,chat-edit');
    Route::post('chat/messages/{message}/retract', [ChatController::class, 'retract'])->where('message', '[0-9]+')->middleware('throttle:30,1,chat-edit');
    Route::post('chat/read', [ChatController::class, 'read']);
    Route::post('chat/claim', [ChatController::class, 'claim']); // ambil alih percakapan tamu setelah login
});

// Tamu (belum login): identitas dari formulir, percakapan dikenali lewat token acak di browser.
Route::prefix('chat/guest')->group(function () {
    Route::post('/', [GuestChatController::class, 'start'])->middleware('throttle:10,60');
    Route::get('/', [GuestChatController::class, 'show']);
    Route::post('messages', [GuestChatController::class, 'send'])->middleware('throttle:30,1');
    Route::put('messages/{message}', [GuestChatController::class, 'update'])->where('message', '[0-9]+')->middleware('throttle:30,1,chat-edit');
    Route::post('messages/{message}/retract', [GuestChatController::class, 'retract'])->where('message', '[0-9]+')->middleware('throttle:30,1,chat-edit');
    Route::post('read', [GuestChatController::class, 'read']);
});

// Admin: tanpa middleware audit (pesan chat adalah catatannya sendiri; badge hanya baca).
Route::prefix('admin')->middleware(['auth:sanctum', 'role:admin,super_admin'])->group(function () {
    Route::get('badges', [Admin\BadgeController::class, 'show']);

    // Lonceng panel admin: baris user_notifications milik admin yang login. Controller yang sama dengan lonceng
    // customer karena daftar dan tandai-dibaca hanya bergantung pada user sesi; tanpa modul khusus.
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
    Route::post('notifications/{id}/read', [NotificationController::class, 'read'])->where('id', '[0-9]+');

    Route::middleware('module:chat')->group(function () {
        Route::get('chats', [Admin\ChatController::class, 'index']);
        Route::post('chats', [Admin\ChatController::class, 'open']);
        Route::get('chats/{conversation}', [Admin\ChatController::class, 'show'])->where('conversation', '[0-9]+');
        Route::post('chats/{conversation}/messages', [Admin\ChatController::class, 'send'])->where('conversation', '[0-9]+');
        Route::post('chats/{conversation}/read', [Admin\ChatController::class, 'read'])->where('conversation', '[0-9]+');
        // Edit/tarik pesan milik admin itu sendiri selama jendela edit (ASUMSI A-99).
        Route::put('chats/{conversation}/messages/{message}', [Admin\ChatController::class, 'update'])->where(['conversation' => '[0-9]+', 'message' => '[0-9]+']);
        Route::post('chats/{conversation}/messages/{message}/retract', [Admin\ChatController::class, 'retract'])->where(['conversation' => '[0-9]+', 'message' => '[0-9]+']);
        // Arsip: satu-satunya cara menyingkirkan percakapan dari kotak masuk (tidak ada rute hapus). Dicatat audit.
        Route::post('chats/{conversation}/archive', [Admin\ChatController::class, 'archive'])->where('conversation', '[0-9]+')->middleware('audit');
        Route::post('chats/{conversation}/unarchive', [Admin\ChatController::class, 'unarchive'])->where('conversation', '[0-9]+')->middleware('audit');
    });
});
