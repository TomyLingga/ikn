<?php

namespace App\Http\Requests\PublicSite;

use App\Http\Requests\Account\AccountFormRequest;
use App\Models\Region;
use Illuminate\Validation\Rule;

// GET /regions?level=province | ?parent=31.75 (tanpa keduanya = daftar provinsi).
class RegionIndexRequest extends AccountFormRequest
{
    public function rules(): array
    {
        return [
            'level' => ['nullable', 'string', Rule::in(Region::LEVELS)],
            'parent' => ['nullable', 'string', 'max:16', 'regex:'.Region::CODE_PATTERN],
        ];
    }
}
