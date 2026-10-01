<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

// Dasar semua controller API: envelope { data } dan { data, meta } untuk paginasi (kontrak bagian 1).
abstract class ApiController extends Controller
{
    protected function data($data, int $status = 200, array $extra = []): JsonResponse
    {
        return response()->json(array_merge(['data' => $data], $extra), $status);
    }

    protected function created($data, array $extra = []): JsonResponse
    {
        return $this->data($data, 201, $extra);
    }

    protected function deleted(): JsonResponse
    {
        return $this->data(['deleted' => true]);
    }

    /**
     * @param  class-string<\Illuminate\Http\Resources\Json\JsonResource>  $resource
     * @param  array  $extraMeta  mis. ['counts' => [...]] untuk angka tab daftar admin
     */
    protected function paginated(LengthAwarePaginator $paginator, string $resource, array $extraMeta = []): JsonResponse
    {
        return response()->json([
            'data' => $resource::collection(collect($paginator->items())),
            'meta' => array_merge([
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ], $extraMeta),
        ]);
    }

    /**
     * Jumlah baris per status (sepanjang waktu, tanpa filter) untuk angka pada tab daftar admin.
     *
     * @param  \Illuminate\Database\Eloquent\Builder|\Illuminate\Database\Query\Builder  $query
     * @param  string[]  $statuses
     */
    protected function statusCounts($query, array $statuses, string $column = 'status'): array
    {
        $rows = $query->selectRaw("{$column} AS status_key, COUNT(*) AS total")->groupBy($column)->pluck('total', 'status_key');
        $out = [];
        foreach ($statuses as $status) {
            $out[$status] = (int) ($rows[$status] ?? 0);
        }

        return $out;
    }

    protected function perPage(int $default = 20, int $max = 100): int
    {
        $perPage = (int) request()->query('perPage', $default);

        return max(1, min($max, $perPage ?: $default));
    }
}
