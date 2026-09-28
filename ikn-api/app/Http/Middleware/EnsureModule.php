<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Services\Auth\ModuleAccess;
use Closure;
use Illuminate\Http\Request;

// Pemakaian: middleware('module:cms'). super_admin selalu lolos.
class EnsureModule
{
    public function __construct(private ModuleAccess $access)
    {
    }

    public function handle(Request $request, Closure $next, string $module)
    {
        $user = $request->user();

        if (! $user || ! $this->access->allows($user, $module)) {
            throw ApiException::forbidden(__('api.module_forbidden', ['module' => $module]));
        }

        return $next($request);
    }
}
