<?php

namespace App\Http\Requests\Geo;

use App\Http\Requests\Account\AccountFormRequest;
use App\Services\Geo\NominatimClient;
use Illuminate\Validation\Rule;

// GET /geo/search?q=&scope= (kontrak bagian 5): scope id (bawaan, countrycodes=id) atau world (pelabuhan tujuan CIF, A-89).
class GeoSearchRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:3', 'max:200'],
            'scope' => ['nullable', 'string', Rule::in(NominatimClient::SCOPES)],
        ];
    }

    public function scope(): string
    {
        $scope = $this->input('scope');

        return is_string($scope) && in_array($scope, NominatimClient::SCOPES, true) ? $scope : NominatimClient::SCOPE_ID;
    }
}
