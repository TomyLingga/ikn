<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\PublicSite\RegionIndexRequest;
use App\Http\Requests\PublicSite\RegionSearchRequest;
use App\Http\Resources\RegionResource;
use App\Models\Region;

// Wilayah Kemendagri publik (kontrak bagian 5).
class RegionController extends ApiController
{
    public const SEARCH_LIMIT = 20;

    // ?parent=31.75 → anak langsung; ?level=province → semua di level itu; tanpa keduanya → provinsi.
    public function index(RegionIndexRequest $request)
    {
        $query = Region::query()->orderBy('name');

        if ($parent = $request->input('parent')) {
            $query->childrenOf($parent);
        } else {
            $query->level($request->input('level') ?: Region::LEVEL_PROVINCE);
        }

        return $this->data(RegionResource::collection($query->get()));
    }

    // ILIKE lintas level, maks 20, disertai jalur nama induk (path[] + fullName).
    public function search(RegionSearchRequest $request)
    {
        $query = Region::query()->search($request->input('q'))->orderBy('level')->orderBy('name')->limit(self::SEARCH_LIMIT);

        if ($level = $request->input('level')) {
            $query->level($level);
        }

        $results = $query->get();

        $ancestorCodes = [];
        foreach ($results as $region) {
            $ancestorCodes = array_merge($ancestorCodes, Region::ancestorCodes($region->code));
        }
        $names = $ancestorCodes === []
            ? collect()
            : Region::query()->whereIn('code', array_unique($ancestorCodes))->pluck('name', 'code');

        $items = $results->map(function (Region $region) use ($names) {
            $path = [];
            foreach (Region::ancestorCodes($region->code) as $code) {
                $path[] = $names->get($code, $code);
            }

            return (new RegionResource($region))->withPath($path);
        });

        return $this->data($items->values());
    }
}
