<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherUsage;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Validasi voucher dan siklus kuota per order (KEPUTUSAN diskon; ASUMSI A-23 scope kategori):
 * reserve saat checkout → commit saat paid → release saat expired/cancelled. Semua idempoten per order_id.
 */
class VoucherService
{
    public const REASON_NOT_FOUND = 'not_found';
    public const REASON_INACTIVE = 'inactive';
    public const REASON_EXPIRED = 'expired';
    public const REASON_NOT_STARTED = 'not_started';
    public const REASON_QUOTA = 'quota';
    public const REASON_PER_USER_LIMIT = 'per_user_limit';
    public const REASON_MIN_SUBTOTAL = 'min_subtotal';
    public const REASON_SCOPE = 'scope';
    public const REASON_NOT_ELIGIBLE = 'not_eligible';

    /**
     * @param  Voucher|string  $code
     * @param  int[]  $categoryIds  kategori item di keranjang (untuk scope)
     *
     * @throws ApiException 409 VOUCHER_INVALID + meta.reason
     */
    public function validate($code, User $user, int $subtotal, array $categoryIds): Voucher
    {
        $voucher = $code instanceof Voucher ? $code : Voucher::where('code', strtoupper(trim((string) $code)))->first();
        if (! $voucher) {
            throw $this->invalid(self::REASON_NOT_FOUND);
        }
        // Voucher khusus customer tertentu (ASUMSI A-67): akun lain ditolak sebelum status voucher diungkap.
        if (! $voucher->eligibleFor($user)) {
            throw $this->invalid(self::REASON_NOT_ELIGIBLE, $voucher);
        }
        if (! $voucher->is_active) {
            throw $this->invalid(self::REASON_INACTIVE, $voucher);
        }
        $now = now();
        if ($voucher->starts_at && $voucher->starts_at->gt($now)) {
            throw $this->invalid(self::REASON_NOT_STARTED, $voucher);
        }
        if ($voucher->ends_at && $voucher->ends_at->lt($now)) {
            throw $this->invalid(self::REASON_EXPIRED, $voucher);
        }
        if ($voucher->quota !== null && $voucher->used_count >= $voucher->quota) {
            throw $this->invalid(self::REASON_QUOTA, $voucher);
        }
        if ($voucher->per_user_limit !== null && $this->userUsageCount($voucher, $user) >= $voucher->per_user_limit) {
            throw $this->invalid(self::REASON_PER_USER_LIMIT, $voucher);
        }
        if ($subtotal < $voucher->minSubtotalInt()) {
            throw $this->invalid(self::REASON_MIN_SUBTOTAL, $voucher, ['minSubtotal' => $voucher->minSubtotalInt()]);
        }
        if (! $voucher->appliesToAll() && array_intersect($voucher->discountCategoryIds(), array_map('intval', $categoryIds)) === []) {
            throw $this->invalid(self::REASON_SCOPE, $voucher);
        }

        return $voucher;
    }

    /**
     * Nominal diskon (rupiah bulat) untuk subtotal dan item tertentu.
     * Voucher scope kategori hanya dihitung dari item kategori tersebut.
     *
     * @param  array<int, array{categoryId:int, lineTotal:int}>  $items
     */
    public function discountFor(Voucher $voucher, int $subtotal, array $items): int
    {
        $base = $subtotal;
        if (! $voucher->appliesToAll()) {
            $base = 0;
            $ids = $voucher->discountCategoryIds();
            foreach ($items as $item) {
                if (in_array((int) ($item['categoryId'] ?? 0), $ids, true)) {
                    $base += (int) ($item['lineTotal'] ?? 0);
                }
            }
        }
        if ($base <= 0) {
            return 0;
        }

        $discount = $voucher->type === Voucher::TYPE_PERCENT
            ? Money::round($base * (float) $voucher->value / 100)
            : Money::toInt($voucher->value);

        $cap = $voucher->maxDiscountInt();
        if ($cap !== null) {
            $discount = min($discount, $cap);
        }

        return max(0, min($discount, $base));
    }

    /** Apakah item (kategori) ikut kena voucher ini (untuk alokasi diskon per item). */
    public function coversCategory(Voucher $voucher, int $categoryId): bool
    {
        return $voucher->appliesToAll() || in_array($categoryId, $voucher->discountCategoryIds(), true);
    }

    /** Reservasi kuota untuk order (idempoten per order_id): used_count+1 hanya saat baris baru dibuat. */
    public function reserve(Voucher $voucher, User $user, int $orderId): VoucherUsage
    {
        return DB::transaction(function () use ($voucher, $user, $orderId) {
            $existing = VoucherUsage::where('order_id', $orderId)->first();
            if ($existing) {
                return $existing;
            }

            $locked = Voucher::whereKey($voucher->id)->lockForUpdate()->first();
            if ($locked->quota !== null && $locked->used_count >= $locked->quota) {
                throw $this->invalid(self::REASON_QUOTA, $locked);
            }
            // Cek ulang batas per akun di bawah kunci baris voucher: dua checkout bersamaan tidak bisa sama-sama lolos.
            if ($locked->per_user_limit !== null && $this->userUsageCount($locked, $user) >= $locked->per_user_limit) {
                throw $this->invalid(self::REASON_PER_USER_LIMIT, $locked);
            }

            $usage = VoucherUsage::create([
                'voucher_id' => $locked->id,
                'user_id' => $user->id,
                'order_id' => $orderId,
                'status' => VoucherUsage::STATUS_RESERVED,
            ]);
            Voucher::whereKey($locked->id)->increment('used_count');
            $voucher->used_count = $locked->used_count + 1;

            return $usage;
        });
    }

    /** reserved → committed (idempoten). */
    public function commit(int $orderId): ?VoucherUsage
    {
        return DB::transaction(function () use ($orderId) {
            $usage = VoucherUsage::where('order_id', $orderId)->lockForUpdate()->first();
            if (! $usage) {
                return null;
            }
            if ($usage->status === VoucherUsage::STATUS_RESERVED) {
                $usage->update(['status' => VoucherUsage::STATUS_COMMITTED]);
            }

            return $usage;
        });
    }

    /** reserved/committed → released; used_count−1 tepat sekali (idempoten). */
    public function release(int $orderId): ?VoucherUsage
    {
        return DB::transaction(function () use ($orderId) {
            $usage = VoucherUsage::where('order_id', $orderId)->lockForUpdate()->first();
            if (! $usage) {
                return null;
            }
            if ($usage->status !== VoucherUsage::STATUS_RELEASED) {
                $usage->update(['status' => VoucherUsage::STATUS_RELEASED]);
                Voucher::whereKey($usage->voucher_id)->where('used_count', '>', 0)->decrement('used_count');
            }

            return $usage;
        });
    }

    /**
     * Voucher yang ditujukan khusus ke customer ini dan masih bisa dipakai sekarang
     * (aktif, dalam periode, kuota dan batas per akun belum habis). Untuk GET /customer/vouchers.
     *
     * @return \Illuminate\Support\Collection<int, Voucher>
     */
    public function assignedTo(User $user)
    {
        $now = now();

        return Voucher::active()
            ->where('audience', Voucher::AUDIENCE_CUSTOMERS)
            ->whereHas('customers', fn ($q) => $q->whereKey($user->id))
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now))
            ->where(fn ($q) => $q->whereNull('quota')->orWhereColumn('used_count', '<', 'quota'))
            ->orderByRaw('ends_at IS NULL')->orderBy('ends_at')->orderBy('id')
            ->get()
            ->filter(fn (Voucher $voucher) => $voucher->per_user_limit === null || $this->userUsageCount($voucher, $user) < $voucher->per_user_limit)
            ->values();
    }

    private function userUsageCount(Voucher $voucher, User $user): int
    {
        return VoucherUsage::where('voucher_id', $voucher->id)->where('user_id', $user->id)
            ->whereIn('status', [VoucherUsage::STATUS_RESERVED, VoucherUsage::STATUS_COMMITTED])
            ->count();
    }

    private function invalid(string $reason, ?Voucher $voucher = null, array $extra = []): ApiException
    {
        return ApiException::conflict('VOUCHER_INVALID', __('catalog.voucher.'.$reason), array_merge([
            'reason' => $reason,
            'code' => $voucher?->code,
        ], $extra));
    }
}
