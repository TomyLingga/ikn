<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// API selalu menjawab JSON, apa pun header Accept dari klien.
class ForceJsonResponse
{
    public function handle(Request $request, Closure $next)
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
