<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\ShippingZoneRequest;
use App\Http\Resources\ShippingZoneResource;
use App\Models\ShippingZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Zona ongkir + wilayah cakupan (kontrak 11.5). regions[] { code, level } menggantikan seluruh daftar bila dikirim.
class ShippingZoneController extends ApiController
{
    public function index(Request $request)
    {
        $zones = ShippingZone::with(['regions', 'rates'])
            ->when($request->query('q'), function ($q, $s) {
                $like = '%'.$s.'%';
                $q->where(fn ($w) => $w->where('name->id', 'ilike', $like)->orWhere('name->en', 'ilike', $like));
            })
            ->orderByDesc('priority')->orderBy('id')->get();

        return $this->data(ShippingZoneResource::collection($zones));
    }

    public function store(ShippingZoneRequest $request)
    {
        $data = $request->validated();

        $zone = DB::transaction(function () use ($data) {
            $zone = ShippingZone::create($this->attributes($data, null));
            $this->syncRegions($zone, $data['regions'] ?? []);

            return $zone;
        });

        return $this->created(new ShippingZoneResource($zone->fresh(['regions', 'rates'])));
    }

    public function show(ShippingZone $shippingZone)
    {
        return $this->data(new ShippingZoneResource($shippingZone->load(['regions', 'rates'])));
    }

    public function update(ShippingZoneRequest $request, ShippingZone $shippingZone)
    {
        $data = $request->validated();

        DB::transaction(function () use ($shippingZone, $data) {
            $shippingZone->update($this->attributes($data, $shippingZone));
            if (array_key_exists('regions', $data)) {
                $this->syncRegions($shippingZone, $data['regions'] ?? []);
            }
        });

        return $this->data(new ShippingZoneResource($shippingZone->fresh(['regions', 'rates'])));
    }

    public function destroy(ShippingZone $shippingZone)
    {
        $shippingZone->delete(); // rates + regions ikut terhapus (cascade)

        return $this->deleted();
    }

    private function attributes(array $data, ?ShippingZone $existing): array
    {
        return [
            'name' => $data['name'],
            'is_active' => array_key_exists('isActive', $data) ? (bool) $data['isActive'] : ($existing->is_active ?? true),
            'is_default' => array_key_exists('isDefault', $data) ? (bool) $data['isDefault'] : ($existing->is_default ?? false),
            'priority' => array_key_exists('priority', $data) ? (int) $data['priority'] : ($existing->priority ?? 0),
        ];
    }

    private function syncRegions(ShippingZone $zone, array $regions): void
    {
        $zone->regions()->delete();

        $seen = [];
        foreach ($regions as $region) {
            $code = trim((string) $region['code']);
            if ($code === '' || isset($seen[$code])) {
                continue;
            }
            $seen[$code] = true;
            $zone->regions()->create(['region_code' => $code, 'level' => $region['level']]);
        }
    }
}
