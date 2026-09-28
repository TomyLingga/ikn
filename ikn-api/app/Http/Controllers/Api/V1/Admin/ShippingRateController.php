<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\ShippingRateRequest;
use App\Http\Resources\ShippingRateResource;
use App\Models\ShippingRate;
use App\Models\ShippingZone;
use Illuminate\Http\Request;

// Tarif ongkir per zona (kontrak 11.5) + alias GET /admin/shipping-methods (daftar rate lintas zona untuk FE lama).
class ShippingRateController extends ApiController
{
    public function index(ShippingZone $shippingZone)
    {
        return $this->data(ShippingRateResource::collection($shippingZone->rates()->with('zone')->get()));
    }

    public function store(ShippingRateRequest $request, ShippingZone $shippingZone)
    {
        $rate = $shippingZone->rates()->create($this->attributes($request->validated(), null));

        return $this->created(new ShippingRateResource($rate->load('zone')));
    }

    public function update(ShippingRateRequest $request, ShippingRate $shippingRate)
    {
        $data = $request->validated();
        $attributes = $this->attributes($data, $shippingRate);
        if (! empty($data['zoneId'])) {
            $attributes['zone_id'] = (int) $data['zoneId'];
        }
        $shippingRate->update($attributes);

        return $this->data(new ShippingRateResource($shippingRate->fresh('zone')));
    }

    public function destroy(ShippingRate $shippingRate)
    {
        $shippingRate->delete();

        return $this->deleted();
    }

    /** Alias kompatibilitas: semua rate lintas zona. */
    public function methods(Request $request)
    {
        $rates = ShippingRate::with('zone')
            ->when($request->query('active') !== null && $request->query('active') !== '', fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->orderBy('zone_id')->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(ShippingRateResource::collection($rates));
    }

    private function attributes(array $data, ?ShippingRate $existing): array
    {
        return [
            'name' => $data['name'],
            'type' => $data['type'],
            'base_amount' => (int) ($data['baseAmount'] ?? 0),
            'per_kg_amount' => (int) ($data['perKgAmount'] ?? 0),
            'min_amount' => (int) ($data['minAmount'] ?? 0),
            'free_above' => array_key_exists('freeAbove', $data) && $data['freeAbove'] !== null ? (int) $data['freeAbove'] : null,
            'eta' => $data['eta'] ?? null,
            'is_active' => array_key_exists('isActive', $data) ? (bool) $data['isActive'] : ($existing->is_active ?? true),
            'sort_order' => array_key_exists('sortOrder', $data) ? (int) $data['sortOrder'] : ($existing->sort_order ?? 0),
        ];
    }
}
