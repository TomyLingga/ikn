<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\FeeRequest;
use App\Http\Resources\FeeResource;
use App\Models\Fee;
use Illuminate\Http\Request;

// Biaya tambahan (kontrak 11.5): fee aktif ditambahkan OrderCalculator ke setiap order.
class FeeController extends ApiController
{
    public function index(Request $request)
    {
        $fees = Fee::query()
            ->when($request->query('q'), function ($q, $s) {
                $like = '%'.$s.'%';
                $q->where(fn ($w) => $w->where('name->id', 'ilike', $like)->orWhere('name->en', 'ilike', $like));
            })
            ->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(FeeResource::collection($fees));
    }

    public function store(FeeRequest $request)
    {
        $fee = Fee::create($this->attributes($request->validated()));

        return $this->created(new FeeResource($fee));
    }

    public function update(FeeRequest $request, Fee $fee)
    {
        $fee->update($this->attributes($request->validated()));

        return $this->data(new FeeResource($fee->fresh()));
    }

    public function destroy(Fee $fee)
    {
        $fee->delete();

        return $this->deleted();
    }

    private function attributes(array $data): array
    {
        return [
            'name' => $data['name'],
            'type' => $data['type'] ?? Fee::TYPE_OTHER,
            'amount' => (int) $data['amount'],
            'is_active' => (bool) ($data['isActive'] ?? true),
            'sort_order' => (int) ($data['sortOrder'] ?? 0),
        ];
    }
}
