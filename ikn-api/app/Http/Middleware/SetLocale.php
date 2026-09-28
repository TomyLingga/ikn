<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// Bahasa pesan validasi/error mengikuti header Accept-Language (id|en), default id.
class SetLocale
{
    public const SUPPORTED = ['id', 'en'];

    public function handle(Request $request, Closure $next)
    {
        $locale = $request->getPreferredLanguage(self::SUPPORTED) ?: config('app.locale');

        if (! in_array($locale, self::SUPPORTED, true)) {
            $locale = config('app.locale');
        }

        app()->setLocale($locale);

        return $next($request);
    }
}
