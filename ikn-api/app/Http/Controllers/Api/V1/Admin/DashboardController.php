<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Services\Commerce\Reports\DashboardService;
use Illuminate\Http\Request;

// GET /admin/dashboard?year (kontrak 11.1), modul `dashboard`.
class DashboardController extends ApiController
{
    public function show(Request $request, DashboardService $dashboard)
    {
        $request->validate(['year' => ['nullable', 'integer', 'min:2000', 'max:2100']]);
        $year = (int) ($request->query('year') ?: now()->setTimezone(config('app.timezone'))->year);

        return $this->data($dashboard->build($year, $request->user()));
    }
}
