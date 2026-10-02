<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\CertificateRequest;
use App\Http\Resources\CertificateResource;
use App\Models\Certificate;

class CertificateController extends ApiController
{
    public function index()
    {
        return $this->data(CertificateResource::collection(
            Certificate::with('media', 'logo')->orderBy('sort_order')->orderBy('id')->get()
        ));
    }

    public function store(CertificateRequest $request)
    {
        $item = Certificate::create($this->attributes($request->validated()));

        return $this->created(new CertificateResource($item->load('media', 'logo')));
    }

    public function update(CertificateRequest $request, Certificate $certificate)
    {
        $certificate->update($this->attributes($request->validated()));

        return $this->data(new CertificateResource($certificate->fresh(['media', 'logo'])));
    }

    public function destroy(Certificate $certificate)
    {
        $certificate->delete();

        return $this->deleted();
    }

    private function attributes(array $data): array
    {
        return [
            'name' => $data['name'],
            'material' => $data['material'] ?? null,
            'description' => $data['description'] ?? null,
            'media_id' => $data['mediaId'] ?? null,
            'logo_media_id' => $data['logoMediaId'] ?? null,
            'is_published' => $data['isPublished'] ?? true,
            'sort_order' => $data['sortOrder'] ?? 0,
        ];
    }
}
