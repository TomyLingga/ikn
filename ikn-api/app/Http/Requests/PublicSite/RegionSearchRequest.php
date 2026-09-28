<?php

namespace App\Http\Requests\PublicSite;

use App\Http\Requests\Account\AccountFormRequest;
use App\Models\Region;
use Illuminate\Validation\Rule;

// GET /regions/search?q=cakung[&level=district] (ILIKE, maks 20 hasil).
class RegionSearchRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:2', 'max:100'],
            'level' => ['nullable', 'string', Rule::in(Region::LEVELS)],
        ];
    }
}
