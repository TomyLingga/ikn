<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\GalleryItemRequest;
use App\Http\Resources\GalleryItemResource;
use App\Models\GalleryItem;

class GalleryController extends ApiController
{
    public function index()
    {
        return $this->data(GalleryItemResource::collection(
            GalleryItem::with('media')->orderBy('sort_order')->orderByDesc('id')->get()
        ));
    }

    public function store(GalleryItemRequest $request)
    {
        $item = GalleryItem::create($this->attributes($request->validated()));

        return $this->created(new GalleryItemResource($item->load('media')));
    }

    public function update(GalleryItemRequest $request, GalleryItem $galleryItem)
    {
        $galleryItem->update($this->attributes($request->validated()));

        return $this->data(new GalleryItemResource($galleryItem->fresh('media')));
    }

    public function destroy(GalleryItem $galleryItem)
    {
        $galleryItem->delete();

        return $this->deleted();
    }

    private function attributes(array $data): array
    {
        $isVideo = $data['type'] === GalleryItem::TYPE_VIDEO;

        return [
            'title' => $data['title'],
            'type' => $data['type'],
            'media_id' => $isVideo ? null : ($data['mediaId'] ?? null),
            'external_url' => $isVideo ? ($data['externalUrl'] ?? null) : null,
            'is_published' => $data['isPublished'] ?? true,
            'sort_order' => $data['sortOrder'] ?? 0,
        ];
    }
}
