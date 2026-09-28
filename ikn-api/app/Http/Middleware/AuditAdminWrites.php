<?php

namespace App\Http\Middleware;

use App\Services\Audit\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Mencatat setiap aksi tulis (non-GET) admin ke audit_logs setelah respons sukses.
class AuditAdminWrites
{
    public function __construct(private AuditLogger $logger)
    {
    }

    public function handle(Request $request, Closure $next)
    {
        /** @var Response $response */
        $response = $next($request);

        if (! $request->isMethodSafe() && $response->getStatusCode() < 400) {
            $this->logger->logRequest($request, $response);
        }

        return $response;
    }
}
