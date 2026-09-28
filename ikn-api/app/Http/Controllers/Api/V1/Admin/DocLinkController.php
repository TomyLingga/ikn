<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\DocLinkRequest;
use App\Http\Resources\DocLinkResource;
use App\Models\DocLink;
use Illuminate\Http\Request;

// Tautan dokumen di dropdown navigasi (kontrak 11.6 navigation/doc-links).
class DocLinkController extends ApiController
{
    public function index(Request $request)
    {
        $links = DocLink::with('media')
            ->when($request->query('category'), fn ($q, $c) => $q->where('category', $c))
            ->orderBy('category')->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(DocLinkResource::collection($links));
    }

    public function store(DocLinkRequest $request)
    {
        $link = DocLink::create($this->attributes($request->validated()));

        return $this->created(new DocLinkResource($link->load('media')));
    }

    public function update(DocLinkRequest $request, DocLink $docLink)
    {
        $docLink->update($this->attributes($request->validated()));

        return $this->data(new DocLinkResource($docLink->fresh('media')));
    }

    public function destroy(DocLink $docLink)
    {
        $docLink->delete();

        return $this->deleted();
    }

    private function attributes(array $data): array
    {
        return [
            'category' => $data['category'],
            'label' => $data['label'],
            'description' => $data['description'] ?? null,
            'media_id' => $data['mediaId'] ?? null,
            'url' => $data['url'] ?? null,
            'is_active' => $data['isActive'] ?? true,
            'sort_order' => $data['sortOrder'] ?? 0,
        ];
    }
}
