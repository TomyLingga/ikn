<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Geo\GeoReverseRequest;
use App\Http\Requests\Geo\GeoSearchRequest;
use App\Services\Geo\NominatimClient;

// Proxy geocoding Nominatim (kontrak bagian 5): auth:sanctum + throttle:geo (60/menit per IP).
class GeoController extends ApiController
{
    public function __construct(private NominatimClient $nominatim)
    {
    }

    public function search(GeoSearchRequest $request)
    {
        return $this->data($this->nominatim->search($request->input('q')));
    }

    public function reverse(GeoReverseRequest $request)
    {
        return $this->data($this->nominatim->reverse((float) $request->input('lat'), (float) $request->input('lng')));
    }
}
