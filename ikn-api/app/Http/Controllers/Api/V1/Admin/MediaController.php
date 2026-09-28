<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\StoreMediaRequest;
use App\Http\Resources\MediaResource;
use App\Models\Media;
use App\Services\Media\MediaService;
use Illuminate\Http\Request;

// Media library (kontrak 11.6): unggah ke disk public, hapus ditolak bila masih dirujuk.
class MediaController extends ApiController
{
    public function index(Request $request)
    {
        $query = Media::query()
            ->where('disk', Media::DISK_PUBLIC)
            ->when($request->query('collection'), fn ($q, $c) => $q->where('collection', $c))
            ->when($request->query('type') === 'image', fn ($q) => $q->where('mime', 'like', 'image/%'))
            ->when($request->query('type') === 'document', fn ($q) => $q->where('mime', 'not like', 'image/%'))
            ->when($request->query('q'), fn ($q, $s) => $q->where('original_name', 'ilike', '%'.$s.'%'))
            ->orderByDesc('id');

        return $this->paginated($query->paginate($this->perPage(30)), MediaResource::class);
    }

    public function store(StoreMediaRequest $request, MediaService $service)
    {
        $media = $service->upload(
            $request->file('file'),
            $request->input('collection', 'general'),
            Media::DISK_PUBLIC,
            $request->user()
        );

        return $this->created(new MediaResource($media));
    }

    public function destroy(Media $media, MediaService $service)
    {
        $service->delete($media);

        return $this->deleted();
    }
}
