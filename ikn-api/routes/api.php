<?php

use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\FileController;
use App\Http\Controllers\Api\V1\PingController;
use App\Http\Controllers\Api\V1\PublicSite;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1 (prefix /api/v1 dipasang di RouteServiceProvider)
|--------------------------------------------------------------------------
| Kontrak: plan/02-api-contract.md. Spesifikasi mesin: docs/openapi.yaml.
*/

Route::get('ping', PingController::class);

// ---- Auth (Sanctum cookie SPA) ----
Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:auth');
    Route::post('admin/login', [AuthController::class, 'adminLogin'])->middleware('throttle:auth');
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
    });
});

// ---- Konten publik ----
Route::prefix('content')->group(function () {
    Route::get('site', [PublicSite\SiteController::class, 'site']);
    Route::get('settings', [PublicSite\SiteController::class, 'settings']);
    Route::get('menus/{location}', [PublicSite\SiteController::class, 'menu']);
    Route::get('doc-links', [PublicSite\SiteController::class, 'docLinks']);
    Route::get('pages/{slug}', [PublicSite\PageController::class, 'show']);
    Route::get('blocks/{key}', [PublicSite\PageController::class, 'block']);
    Route::get('news', [PublicSite\ContentController::class, 'news']);
    Route::get('news/{slug}', [PublicSite\ContentController::class, 'newsDetail']);
    Route::get('gallery', [PublicSite\ContentController::class, 'gallery']);
    Route::get('certificates', [PublicSite\ContentController::class, 'certificates']);
    Route::get('brochures', [PublicSite\ContentController::class, 'brochures']);
    Route::get('customer-logos', [PublicSite\ContentController::class, 'customerLogos']);
});

// ---- Formulir publik ----
Route::post('wbs', [PublicSite\WbsController::class, 'store'])->middleware('throttle:public-form');
Route::get('wbs/{code}', [PublicSite\WbsController::class, 'show']);
Route::post('contact', [PublicSite\ContactController::class, 'store'])->middleware('throttle:public-form');

// ---- Berkas privat ----
Route::get('files/{media}', [FileController::class, 'show'])->middleware('auth:sanctum');

// ---- Admin ----
Route::prefix('admin')
    ->middleware(['auth:sanctum', 'role:admin,super_admin', 'audit'])
    ->group(function () {
        Route::get('permissions/self', [Admin\PermissionController::class, 'self']);

        Route::middleware('role:super_admin')->group(function () {
            Route::get('users', [Admin\UserController::class, 'index']);
            Route::post('users', [Admin\UserController::class, 'store']);
            Route::put('users/{user}', [Admin\UserController::class, 'update']);
            Route::get('users/modules', [Admin\UserController::class, 'modules']);
        });

        Route::middleware('module:media')->group(function () {
            Route::get('media', [Admin\MediaController::class, 'index']);
            Route::post('media', [Admin\MediaController::class, 'store']);
            Route::delete('media/{media}', [Admin\MediaController::class, 'destroy']);
        });

        Route::middleware('module:settings')->group(function () {
            // Pengaturan situs (company profile). /admin/settings dicadangkan untuk pengaturan commerce (kontrak 11.5).
            Route::get('site-settings', [Admin\SettingController::class, 'index']);
            Route::put('site-settings', [Admin\SettingController::class, 'update']);
        });

        Route::middleware('module:users')->group(function () {
            Route::get('help-guide', [Admin\HelpGuideController::class, 'show']);
            Route::post('help-guide', [Admin\HelpGuideController::class, 'store']);
        });

        Route::middleware('module:cms')->group(function () {
            Route::get('cms/section-types', [Admin\SectionController::class, 'types']);
            Route::get('pages', [Admin\PageController::class, 'index']);
            Route::post('pages', [Admin\PageController::class, 'store']);
            Route::get('pages/{page}', [Admin\PageController::class, 'show']);
            Route::put('pages/{page}', [Admin\PageController::class, 'update']);
            Route::delete('pages/{page}', [Admin\PageController::class, 'destroy']);
            Route::get('pages/{page}/sections', [Admin\SectionController::class, 'index']);
            Route::post('pages/{page}/sections', [Admin\SectionController::class, 'store']);
            Route::put('pages/{page}/sections/reorder', [Admin\SectionController::class, 'reorder']);
            Route::put('sections/{section}', [Admin\SectionController::class, 'update']);
            Route::delete('sections/{section}', [Admin\SectionController::class, 'destroy']);
            Route::get('blocks/{key}', [Admin\BlockController::class, 'show']);
            Route::put('blocks/{key}', [Admin\BlockController::class, 'update']);
            Route::get('menus/{location}', [Admin\MenuController::class, 'show']);
            Route::put('menus/{location}', [Admin\MenuController::class, 'update']);
            Route::apiResource('customer-logos', Admin\CustomerLogoController::class)->except('show')->parameters(['customer-logos' => 'customerLogo']);
            Route::apiResource('navigation/doc-links', Admin\DocLinkController::class)->except('show')->parameters(['doc-links' => 'docLink']);
        });

        Route::middleware('module:messages')->group(function () {
            Route::get('contact-messages', [Admin\ContactMessageController::class, 'index']);
            Route::put('contact-messages/{contactMessage}/read', [Admin\ContactMessageController::class, 'markRead']);
        });

        Route::middleware('module:news')->group(function () {
            Route::apiResource('news', Admin\PostController::class)->parameters(['news' => 'post']);
        });

        Route::middleware('module:gallery')->group(function () {
            Route::apiResource('gallery', Admin\GalleryController::class)->except('show')->parameters(['gallery' => 'galleryItem']);
        });

        Route::middleware('module:certificates')->group(function () {
            Route::apiResource('certificates', Admin\CertificateController::class)->except('show');
        });

        Route::middleware('module:brochures')->group(function () {
            Route::apiResource('brochures', Admin\BrochureController::class)->except('show');
        });

        Route::middleware('module:wbs')->group(function () {
            Route::get('whistleblowing', [Admin\WbsController::class, 'index']);
            Route::get('whistleblowing/{wbsReport}', [Admin\WbsController::class, 'show']);
            Route::put('whistleblowing/{wbsReport}', [Admin\WbsController::class, 'update']);
            Route::get('wbs/config', [Admin\WbsController::class, 'config']);
            Route::post('wbs/upload', [Admin\WbsController::class, 'upload']);
        });
    });
