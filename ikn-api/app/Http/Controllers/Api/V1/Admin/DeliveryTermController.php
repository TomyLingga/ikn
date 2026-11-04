<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\DeliveryTermRequest;
use App\Http\Resources\AdminDeliveryTermResource;
use App\Models\DeliveryTerm;

// Cara serah terima (kontrak 11.8, ASUMSI A-85), modul shipping. Hapus ditolak bila sudah dipakai order.
class DeliveryTermController extends ApiController
{
    public function index()
    {
        $terms = DeliveryTerm::withCount('orders')->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(AdminDeliveryTermResource::collection($terms));
    }

    public function store(DeliveryTermRequest $request)
    {
        $data = $request->validated();
        $term = DeliveryTerm::create(['code' => strtolower($data['code'])] + $this->attributes($data, null));

        return $this->created(new AdminDeliveryTermResource($term->fresh()));
    }

    public function update(DeliveryTermRequest $request, DeliveryTerm $deliveryTerm)
    {
        $deliveryTerm->update($this->attributes($request->validated(), $deliveryTerm));

        return $this->data(new AdminDeliveryTermResource($deliveryTerm->fresh()));
    }

    public function destroy(DeliveryTerm $deliveryTerm)
    {
        if ($deliveryTerm->orders()->exists()) {
            throw ApiException::conflict('DELIVERY_TERM_IN_USE', __('catalog.delivery_term_in_use'));
        }
        $deliveryTerm->delete();

        return $this->deleted();
    }

    private function attributes(array $data, ?DeliveryTerm $existing): array
    {
        $bool = fn (string $key, bool $default) => array_key_exists($key, $data) && $data[$key] !== null ? (bool) $data[$key] : $default;

        return [
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'family' => $data['family'],
            'market' => $data['market'],
            'pricing_mode' => $data['pricingMode'],
            // Pajak mengikuti term (ASUMSI A-86): kosong = ikut pasar (export → export_tax_rate, local → tax_rate).
            'tax_profile' => $data['taxProfile'] ?? ($existing?->tax_profile ?? ($data['market'] === DeliveryTerm::MARKET_EXPORT ? DeliveryTerm::TAX_EXPORT : DeliveryTerm::TAX_DOMESTIC)),
            'insurance_included' => $bool('insuranceIncluded', $existing?->insurance_included ?? false),
            'requires_destination_port' => $bool('requiresDestinationPort', $existing?->requires_destination_port ?? false),
            'loading_port' => isset($data['loadingPort']) && trim((string) $data['loadingPort']) !== '' ? trim((string) $data['loadingPort']) : null,
            'is_active' => $bool('isActive', $existing?->is_active ?? true),
            'sort_order' => array_key_exists('sortOrder', $data) && $data['sortOrder'] !== null ? (int) $data['sortOrder'] : ($existing?->sort_order ?? 0),
        ];
    }
}
