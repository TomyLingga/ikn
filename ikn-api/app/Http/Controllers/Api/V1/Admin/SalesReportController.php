<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\SalesReportRequest;
use App\Services\Commerce\Reports\SalesReportService;

// GET /admin/reports/sales?year&month&from&to&format=csv (kontrak 11.1), modul `reports`.
class SalesReportController extends ApiController
{
    public function show(SalesReportRequest $request, SalesReportService $reports)
    {
        $period = $request->period();

        if ($request->wantsCsv()) {
            return response($reports->csv($period), 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'.$reports->csvFilename($period).'"',
                'Cache-Control' => 'private, max-age=0',
            ]);
        }

        return $this->data($reports->build($period));
    }
}
