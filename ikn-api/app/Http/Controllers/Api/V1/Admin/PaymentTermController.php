<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\PaymentTermRequest;
use App\Http\Resources\AdminPaymentTermResource;
use App\Models\PaymentTerm;

// Syarat pembayaran (kontrak 11.10, ASUMSI A-87), modul payment_methods. Hapus ditolak bila sudah dipakai order.
class PaymentTermController extends ApiController
{
    public function index()
    {
        $terms = PaymentTerm::withCount('orders')->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(AdminPaymentTermResource::collection($terms));
    }

    public function store(PaymentTermRequest $request)
    {
        $data = $request->validated();
        $term = PaymentTerm::create(['code' => strtolower($data['code'])] + $this->attributes($data, null));

        return $this->created(new AdminPaymentTermResource($term->fresh()));
    }

    public function update(PaymentTermRequest $request, PaymentTerm $paymentTerm)
    {
        $paymentTerm->update($this->attributes($request->validated(), $paymentTerm));

        return $this->data(new AdminPaymentTermResource($paymentTerm->fresh()));
    }

    public function destroy(PaymentTerm $paymentTerm)
    {
        if ($paymentTerm->orders()->exists()) {
            throw ApiException::conflict('PAYMENT_TERM_IN_USE', __('commerce.payment_term_in_use'));
        }
        $paymentTerm->delete();

        return $this->deleted();
    }

    private function attributes(array $data, ?PaymentTerm $existing): array
    {
        return [
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'market' => $data['market'] ?? ($existing?->market ?? PaymentTerm::MARKET_EXPORT),
            'is_active' => array_key_exists('isActive', $data) && $data['isActive'] !== null ? (bool) $data['isActive'] : ($existing?->is_active ?? true),
            'sort_order' => array_key_exists('sortOrder', $data) && $data['sortOrder'] !== null ? (int) $data['sortOrder'] : ($existing?->sort_order ?? 0),
        ];
    }
}
