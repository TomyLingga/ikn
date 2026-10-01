<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\VoucherRequest;
use App\Http\Resources\VoucherResource;
use App\Models\Voucher;
use App\Services\Notification\InAppNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Voucher (kontrak 11.5): scope all atau categoryIds[] (ASUMSI A-23); sasaran semua customer atau customerIds[]
// (ASUMSI A-67). usedCount dikelola VoucherService.
class VoucherController extends ApiController
{
    public function __construct(private InAppNotifier $inApp)
    {
    }

    public function index(Request $request)
    {
        $query = Voucher::with('customers.profile')
            ->when($request->query('q'), fn ($q, $s) => $q->where('code', 'ilike', '%'.strtoupper($s).'%'))
            ->when($request->query('active') !== null && $request->query('active') !== '', fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->when(in_array($request->query('audience'), Voucher::AUDIENCES, true), fn ($q) => $q->where('audience', $request->query('audience')))
            ->orderByDesc('id');

        return $this->paginated($query->paginate($this->perPage(20)), VoucherResource::class);
    }

    public function store(VoucherRequest $request)
    {
        $data = $request->validated();
        $voucher = DB::transaction(function () use ($data) {
            $voucher = Voucher::create($this->attributes($data, null));
            $this->notifyAssigned($voucher, $voucher->syncAudience($voucher->audience, $data['customerIds'] ?? []));

            return $voucher;
        });

        return $this->created(new VoucherResource($voucher->load('customers.profile')));
    }

    public function show(Voucher $voucher)
    {
        return $this->data(new VoucherResource($voucher->load('customers.profile')));
    }

    public function update(VoucherRequest $request, Voucher $voucher)
    {
        $data = $request->validated();
        DB::transaction(function () use ($data, $voucher) {
            $voucher->update($this->attributes($data, $voucher));
            // Sasaran hanya disentuh bila dikirim (PUT lama tanpa audience tidak menghapus daftar customer).
            if (array_key_exists('audience', $data)) {
                $this->notifyAssigned($voucher, $voucher->syncAudience($voucher->audience, $data['customerIds'] ?? []));
            }
        });

        return $this->data(new VoucherResource($voucher->fresh()->load('customers.profile')));
    }

    public function destroy(Voucher $voucher)
    {
        $voucher->delete(); // order menyimpan voucher_code sebagai snapshot, jadi aman

        return $this->deleted();
    }

    /**
     * Beri tahu customer yang baru mendapat voucher khusus (lonceng portal, ASUMSI A-71).
     *
     * @param  int[]  $customerIds
     */
    private function notifyAssigned(Voucher $voucher, array $customerIds): void
    {
        if (! $voucher->is_active) {
            return;
        }
        foreach ($customerIds as $customerId) {
            $this->inApp->notify($customerId, 'voucher.assigned', ['code' => $voucher->code], '/dashboard/katalog', ['voucherCode' => $voucher->code]);
        }
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
            'audience' => $data['audience'] ?? ($existing->audience ?? Voucher::AUDIENCE_ALL),
        ];
    }
}
