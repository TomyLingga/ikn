<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\PaymentMethodRequest;
use App\Http\Resources\PaymentMethodResource;
use App\Models\PaymentMethod;
use Illuminate\Http\Request;

// Metode bayar (kontrak 11.5): tanpa DELETE (payments merujuk method); nonaktifkan lewat isActive.
class PaymentMethodController extends ApiController
{
    public function index(Request $request)
    {
        $methods = PaymentMethod::query()
            ->when($request->query('q'), function ($q, $s) {
                $like = '%'.$s.'%';
                $q->where(fn ($w) => $w->where('code', 'ilike', $like)->orWhere('name->id', 'ilike', $like)->orWhere('name->en', 'ilike', $like));
            })
            ->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(PaymentMethodResource::collection($methods));
    }

    public function store(PaymentMethodRequest $request)
    {
        $method = PaymentMethod::create($this->attributes($request, null));

        return $this->created(new PaymentMethodResource($method));
    }

    public function show(PaymentMethod $paymentMethod)
    {
        return $this->data(new PaymentMethodResource($paymentMethod));
    }

    public function update(PaymentMethodRequest $request, PaymentMethod $paymentMethod)
    {
        $paymentMethod->update($this->attributes($request, $paymentMethod));

        return $this->data(new PaymentMethodResource($paymentMethod->fresh()));
    }

    private function attributes(PaymentMethodRequest $request, ?PaymentMethod $existing): array
    {
        $data = $request->validated();

        $attributes = [
            'code' => $data['code'],
            'type' => $data['type'],
            'driver' => $data['driver'] ?? ($existing->driver ?? PaymentMethod::DRIVER_MANUAL),
            'name' => $data['name'],
            'instructions' => $data['instructions'] ?? null,
            'is_active' => array_key_exists('isActive', $data) ? (bool) $data['isActive'] : ($existing->is_active ?? false),
            'sort_order' => array_key_exists('sortOrder', $data) ? (int) $data['sortOrder'] : ($existing->sort_order ?? 0),
        ];
        if (array_key_exists('config', $data) || ! $existing) {
            $attributes['config'] = $request->cleanConfig();
        }

        return $attributes;
    }
}
