<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\ShippingRoadFactorRequest;
use App\Services\Commerce\CommerceSettings;

// GET/PUT /admin/shipping/road-factor (modul shipping): faktor jalan untuk tarif per km (jarak ≈ garis lurus × faktor,
// ASUMSI A-76). Sumber tunggal = setting commerce shipping_road_factor (juga `shippingRoadFactor` di /admin/settings).
// CommerceSettings disuntik per aksi (bukan konstruktor) agar cache per request-nya tidak terbawa instance controller.
class ShippingRoadFactorController extends ApiController
{
    public function show(CommerceSettings $settings)
    {
        return $this->data(['roadFactor' => $settings->get('shipping_road_factor')]);
    }

    public function update(ShippingRoadFactorRequest $request, CommerceSettings $settings)
    {
        $settings->update(['shipping_road_factor' => $request->validated()['roadFactor']]);

        return $this->data(['roadFactor' => $settings->get('shipping_road_factor')]);
    }
}
