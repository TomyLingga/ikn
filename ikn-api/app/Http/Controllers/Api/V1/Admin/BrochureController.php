<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\BrochureRequest;
use App\Http\Resources\BrochureResource;
use App\Models\Brochure;

class BrochureController extends ApiController
{
    public function index()
    {
        return $this->data(BrochureResource::collection(
            Brochure::with('media')->orderBy('sort_order')->orderBy('id')->get()
        ));
    }

    public function store(BrochureRequest $request)
    {
        $item = Brochure::create($this->attributes($request->validated()));

        return $this->created(new BrochureResource($item->load('media')));
    }

    public function update(BrochureRequest $request, Brochure $brochure)
    {
        $brochure->update($this->attributes($request->validated()));

        return $this->data(new BrochureResource($brochure->fresh('media')));
    }

    public function destroy(Brochure $brochure)
    {
        $brochure->delete();

        return $this->deleted();
    }

    private function attributes(array $data): array
    {
        return [
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'media_id' => $data['mediaId'] ?? null,
            'is_published' => $data['isPublished'] ?? true,
            'sort_order' => $data['sortOrder'] ?? 0,
        ];
    }
}
