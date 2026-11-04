<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\ExchangeRateIndexRequest;
use App\Http\Requests\Admin\ExchangeRateStoreRequest;
use App\Http\Resources\ExchangeRateResource;
use App\Services\Rates\ExchangeRateService;

// GET/POST /admin/exchange-rates (kontrak 11.7), modul `reports`. Kurs JISDOR informasi keuangan (ASUMSI A-84).
class ExchangeRateController extends ApiController
{
    public function index(ExchangeRateIndexRequest $request, ExchangeRateService $rates)
    {
        $period = $request->period();

        return $this->data($rates->summary($period['from'], $period['to']));
    }

    public function store(ExchangeRateStoreRequest $request, ExchangeRateService $rates)
    {
        $rate = $rates->setManual($request->rateDate(), $request->rateValue());

        return $this->created(new ExchangeRateResource($rate));
    }
}
