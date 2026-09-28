<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

// Pencatat audit aksi admin (ASUMSI A-17: tabel sendiri, tanpa package).
class AuditLogger
{
    private const HIDDEN = ['password', 'password_confirmation', 'passwordConfirmation', 'current_password', 'currentPassword', 'token'];

    public function log(?User $user, string $action, ?Model $subject = null, ?array $before = null, ?array $after = null, ?Request $request = null): ?AuditLog
    {
        try {
            return AuditLog::create([
                'user_id' => $user?->id,
                'action' => mb_substr($action, 0, 128),
                'subject_type' => $subject ? class_basename($subject) : null,
                'subject_id' => $subject?->getKey(),
                'before' => $before,
                'after' => $after,
                'ip' => $request?->ip(),
                'user_agent' => $request ? mb_substr((string) $request->userAgent(), 0, 512) : null,
            ]);
        } catch (Throwable $e) {
            // Audit tidak boleh menggagalkan aksi utama.
            Log::warning('audit log failed: '.$e->getMessage());

            return null;
        }
    }

    // Dipanggil middleware untuk setiap request tulis admin yang sukses.
    public function logRequest(Request $request, Response $response): void
    {
        $route = $request->route();
        $subject = null;

        foreach ($route ? $route->parameters() : [] as $param) {
            if ($param instanceof Model) {
                $subject = $param;
                break;
            }
        }

        $action = $request->method().' '.($route ? $route->uri() : $request->path());

        $after = $request->except(self::HIDDEN);
        $after['_path'] = $request->path();
        $after['_status'] = $response->getStatusCode();

        $this->log($request->user(), $action, $subject, null, $after, $request);
    }
}
