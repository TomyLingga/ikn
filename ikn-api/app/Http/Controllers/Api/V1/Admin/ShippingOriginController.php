<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\ShippingOriginRequest;
use App\Services\Commerce\CommerceSettings;

// GET/PUT /admin/shipping-origin (modul shipping): titik asal gudang + faktor jalan untuk tarif per km (ASUMSI A-76).
class ShippingOriginController extends ApiController
{
    public function __construct(private CommerceSettings $settings)
    {
    }

    public function show()
    {
        return $this->data($this->present());
    }

    public function update(ShippingOriginRequest $request)
    {
        $data = $request->validated();
        $this->settings->update([
            'shipping_origin_label' => $data['label'] ?? '',
            'shipping_origin_lat' => $data['lat'] ?? '',
            'shipping_origin_lng' => $data['lng'] ?? '',
            'shipping_road_factor' => $data['roadFactor'],
        ]);

        return $this->data($this->present());
    }

    private function present(): array
    {
        $all = $this->settings->all();

        return [
            'label' => $all['shipping_origin_label'],
            'lat' => $all['shipping_origin_lat'],
            'lng' => $all['shipping_origin_lng'],
            'roadFactor' => $all['shipping_road_factor'],
        ];
    }
}
