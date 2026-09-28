<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\VoucherRequest;
use App\Http\Resources\VoucherResource;
use App\Models\Voucher;
use Illuminate\Http\Request;

// Voucher (kontrak 11.5): scope all atau categoryIds[] (ASUMSI A-23). usedCount dikelola VoucherService.
class VoucherController extends ApiController
{
    public function index(Request $request)
    {
        $query = Voucher::query()
            ->when($request->query('q'), fn ($q, $s) => $q->where('code', 'ilike', '%'.strtoupper($s).'%'))
            ->when($request->query('active') !== null && $request->query('active') !== '', fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->orderByDesc('id');

        return $this->paginated($query->paginate($this->perPage(20)), VoucherResource::class);
    }

    public function store(VoucherRequest $request)
    {
        $voucher = Voucher::create($this->attributes($request->validated(), null));

        return $this->created(new VoucherResource($voucher));
    }

    public function show(Voucher $voucher)
    {
        return $this->data(new VoucherResource($voucher));
    }

    public function update(VoucherRequest $request, Voucher $voucher)
    {
        $voucher->update($this->attributes($request->validated(), $voucher));

        return $this->data(new VoucherResource($voucher->fresh()));
    }

    public function destroy(Voucher $voucher)
    {
        $voucher->delete(); // order menyimpan voucher_code sebagai snapshot, jadi aman

        return $this->deleted();
    }

    private function attributes(array $data, ?Voucher $existing): array
    {
        $scope = $data['scope'] ?? Voucher::SCOPE_ALL;
        $categoryIds = array_values(array_unique(array_map('intval', $data['categoryIds'] ?? [])));

        return [
            'code' => $data['code'],
            'type' => $data['type'],
            'value' => $data['type'] === Voucher::TYPE_PERCENT ? round((float) $data['value'], 2) : (int) $data['value'],
            'min_subtotal' => (int) ($data['minSubtotal'] ?? 0),
            'max_discount' => isset($data['maxDiscount']) ? (int) $data['maxDiscount'] : null,
            'quota' => isset($data['quota']) ? (int) $data['quota'] : null,
            'per_user_limit' => isset($data['perUserLimit']) ? (int) $data['perUserLimit'] : null,
            'scope' => $scope === Voucher::SCOPE_CATEGORY && $categoryIds
                ? ['type' => Voucher::SCOPE_CATEGORY, 'categoryIds' => $categoryIds]
                : ['type' => Voucher::SCOPE_ALL],
            'starts_at' => $data['startsAt'] ?? null,
            'ends_at' => $data['endsAt'] ?? null,
            'is_active' => array_key_exists('isActive', $data) ? (bool) $data['isActive'] : ($existing->is_active ?? true),
        ];
    }
}
