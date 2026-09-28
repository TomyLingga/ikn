<?php

namespace App\Http\Requests\Geo;

use App\Http\Requests\Account\AccountFormRequest;

// GET /geo/reverse?lat=&lng=
class GeoReverseRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ];
    }
}
