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

    /** @param  class-string<\Illuminate\Http\Resources\Json\JsonResource>  $resource */
    protected function paginated(LengthAwarePaginator $paginator, string $resource): JsonResponse
    {
        return response()->json([
            'data' => $resource::collection(collect($paginator->items())),
            'meta' => [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }

    protected function perPage(int $default = 20, int $max = 100): int
    {
        $perPage = (int) request()->query('perPage', $default);

        return max(1, min($max, $perPage ?: $default));
    }
}
