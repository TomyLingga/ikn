<?php

namespace App\Http\Requests\Geo;

use App\Http\Requests\Account\AccountFormRequest;

// GET /geo/search?q=
class GeoSearchRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:3', 'max:200'],
        ];
    }
}
