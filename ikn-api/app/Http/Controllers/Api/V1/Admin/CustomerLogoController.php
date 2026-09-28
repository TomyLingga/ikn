<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\CustomerLogoRequest;
use App\Http\Resources\CustomerLogoResource;
use App\Models\CustomerLogo;

class CustomerLogoController extends ApiController
{
    public function index()
    {
        return $this->data(CustomerLogoResource::collection(
            CustomerLogo::with('media')->orderBy('sort_order')->orderBy('id')->get()
        ));
    }

    public function store(CustomerLogoRequest $request)
    {
        $logo = CustomerLogo::create($this->attributes($request->validated()));

        return $this->created(new CustomerLogoResource($logo->load('media')));
    }

    public function update(CustomerLogoRequest $request, CustomerLogo $customerLogo)
    {
        $customerLogo->update($this->attributes($request->validated()));

        return $this->data(new CustomerLogoResource($customerLogo->fresh('media')));
    }

    public function destroy(CustomerLogo $customerLogo)
    {
        $customerLogo->delete();

        return $this->deleted();
    }

    private function attributes(array $data): array
    {
        return [
            'name' => $data['name'],
            'media_id' => $data['mediaId'] ?? null,
            'url' => $data['url'] ?? null,
            'is_active' => $data['isActive'] ?? true,
            'sort_order' => $data['sortOrder'] ?? 0,
        ];
    }
}
