<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\FeeRequest;
use App\Http\Resources\FeeResource;
use App\Models\Fee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Biaya tambahan (kontrak 11.5): fee aktif ditambahkan OrderCalculator ke setiap order, atau hanya ke order
// customer tertentu bila audience = customers (ASUMSI A-67).
class FeeController extends ApiController
{
    public function index(Request $request)
    {
        $fees = Fee::with('customers.profile')
            ->when($request->query('q'), function ($q, $s) {
                $like = '%'.$s.'%';
                $q->where(fn ($w) => $w->where('name->id', 'ilike', $like)->orWhere('name->en', 'ilike', $like));
            })
            ->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(FeeResource::collection($fees));
    }

    public function store(FeeRequest $request)
    {
        $data = $request->validated();
        $fee = DB::transaction(function () use ($data) {
            $fee = Fee::create($this->attributes($data, null));
            $fee->syncAudience($fee->audience, $data['customerIds'] ?? []);

            return $fee;
        });

        return $this->created(new FeeResource($fee->load('customers.profile')));
    }

    public function update(FeeRequest $request, Fee $fee)
    {
        $data = $request->validated();
        DB::transaction(function () use ($data, $fee) {
            $fee->update($this->attributes($data, $fee));
            // Sasaran hanya disentuh bila dikirim (PUT lama tanpa audience tidak menghapus daftar customer).
            if (array_key_exists('audience', $data)) {
                $fee->syncAudience($fee->audience, $data['customerIds'] ?? []);
            }
        });

        return $this->data(new FeeResource($fee->fresh()->load('customers.profile')));
    }

    public function destroy(Fee $fee)
    {
        $fee->delete();

        return $this->deleted();
    }

    private function attributes(array $data, ?Fee $existing): array
    {
        return [
            'name' => $data['name'],
            'type' => $data['type'] ?? Fee::TYPE_OTHER,
            'amount' => (int) $data['amount'],
            'is_active' => (bool) ($data['isActive'] ?? true),
            'sort_order' => (int) ($data['sortOrder'] ?? 0),
            'audience' => $data['audience'] ?? ($existing->audience ?? Fee::AUDIENCE_ALL),
        ];
    }
}
