<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

// GET /admin/audit-logs?page&perPage&user&action&from&to (kontrak 11.1), super_admin. user: id atau ILIKE nama/email.
class AuditLogController extends ApiController
{
    public function index(Request $request)
    {
        $request->validate([
            'user' => ['nullable', 'string', 'max:120'],
            'action' => ['nullable', 'string', 'max:160'],
            'subjectType' => ['nullable', 'string', 'max:64'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $tz = config('app.timezone');

        $query = AuditLog::with('user')
            ->when(trim((string) $request->query('user')), function ($q, $user) {
                if (ctype_digit($user)) {
                    $q->where('user_id', (int) $user);
                } else {
                    $like = '%'.addcslashes($user, '%_\\').'%';
                    $q->whereHas('user', fn ($u) => $u->where('name', 'ILIKE', $like)->orWhere('email', 'ILIKE', $like));
                }
            })
            ->when(trim((string) $request->query('action')), fn ($q, $action) => $q->where('action', 'ILIKE', '%'.addcslashes($action, '%_\\').'%'))
            ->when($request->query('subjectType'), fn ($q, $type) => $q->where('subject_type', $type))
            ->when($request->query('from'), fn ($q, $from) => $q->where('created_at', '>=', Carbon::parse($from, $tz)->startOfDay()))
            ->when($request->query('to'), fn ($q, $to) => $q->where('created_at', '<=', Carbon::parse($to, $tz)->endOfDay()))
            ->orderByDesc('created_at')->orderByDesc('id');

        return $this->paginated($query->paginate($this->perPage(20)), AuditLogResource::class);
    }
}
