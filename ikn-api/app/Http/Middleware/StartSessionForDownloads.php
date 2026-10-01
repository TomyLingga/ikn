<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Pipeline;
use Illuminate\Session\Middleware\StartSession;

/**
 * Sesi untuk unduhan berkas privat yang dibuka langsung di tab browser (GET /files/{media}).
 *
 * Sanctum hanya menyalakan sesi bila permintaan membawa Origin/Referer FE. Tautan "buka di tab baru"
 * (rel=noreferrer), alamat yang ditempel, atau muat ulang tidak membawanya, sehingga admin yang sudah
 * login tetap dijawab 401. Middleware ini menyalakan cookie + sesi untuk rute GET tersebut agar
 * guard `web` (dipakai auth:sanctum) mengenali cookie sesi yang sama. Aman untuk rute baca saja:
 * cookie SameSite=Lax tidak ikut pada permintaan lintas-situs selain navigasi tingkat atas, dan
 * otorisasi berkas tetap lewat MediaPolicy. Jangan dipakai untuk rute tulis (tanpa CSRF).
 */
class StartSessionForDownloads
{
    public function handle(Request $request, Closure $next)
    {
        // Permintaan dari FE sudah stateful lewat EnsureFrontendRequestsAreStateful.
        if ($request->hasSession()) {
            return $next($request);
        }

        config(['session.http_only' => true, 'session.same_site' => 'lax']);

        return (new Pipeline(app()))->send($request)->through([
            config('sanctum.middleware.encrypt_cookies', EncryptCookies::class),
            AddQueuedCookiesToResponse::class,
            StartSession::class,
        ])->then(fn ($request) => $next($request));
    }
}
