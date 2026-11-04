<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\FactoryLocationRequest;
use App\Http\Resources\AdminFactoryLocationResource;
use App\Models\FactoryLocation;

// Lokasi pabrik (kontrak 11.8, ASUMSI A-90), modul shipping: titik asal ongkir per km + titik ambil Loco.
// Hapus ditolak bila masih dipakai produk atau bila tinggal satu baris (409 FACTORY_LOCATION_IN_USE).
class FactoryLocationController extends ApiController
{
    public function index()
    {
        $factories = FactoryLocation::withCount('products')->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(AdminFactoryLocationResource::collection($factories));
    }

    public function store(FactoryLocationRequest $request)
    {
        $data = $request->validated();
        $factory = FactoryLocation::create(['code' => $data['code']] + $this->attributes($data, null));

        return $this->created(new AdminFactoryLocationResource($factory->fresh()->loadCount('products')));
    }

    public function update(FactoryLocationRequest $request, FactoryLocation $factoryLocation)
    {
        $factoryLocation->update($this->attributes($request->validated(), $factoryLocation));

        return $this->data(new AdminFactoryLocationResource($factoryLocation->fresh()->loadCount('products')));
    }

    public function destroy(FactoryLocation $factoryLocation)
    {
        if ($factoryLocation->products()->exists()) {
            throw ApiException::conflict('FACTORY_LOCATION_IN_USE', __('catalog.factory_location_in_use'));
        }
        if (FactoryLocation::count() <= 1) {
            throw ApiException::conflict('FACTORY_LOCATION_IN_USE', __('catalog.factory_location_last'));
        }
        $factoryLocation->delete();

        return $this->deleted();
    }

    private function attributes(array $data, ?FactoryLocation $existing): array
    {
        $coord = fn ($value) => $value === null || $value === '' ? null : round((float) $value, 6);

        return [
            'name' => $data['name'],
            'address' => $data['address'],
            'lat' => $coord($data['lat'] ?? null),
            'lng' => $coord($data['lng'] ?? null),
            'allows_pickup' => array_key_exists('allowsPickup', $data) && $data['allowsPickup'] !== null ? (bool) $data['allowsPickup'] : ($existing?->allows_pickup ?? true),
            'sort_order' => array_key_exists('sortOrder', $data) && $data['sortOrder'] !== null
                ? (int) $data['sortOrder']
                : ($existing?->sort_order ?? ((int) FactoryLocation::max('sort_order') + 1)),
        ];
    }
}
