<?php

namespace App\Http\Controllers\Api\V1;

class PingController extends ApiController
{
    public function __invoke()
    {
        return $this->data(['ok' => true, 'time' => now()->toApiString(), 'locale' => app()->getLocale()]);
    }
}
