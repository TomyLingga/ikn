<?php

namespace App\Services\Commerce;

use App\Models\Order;

/**
 * Kode unik transfer manual 1–999 (ASUMSI A-9): unik di antara order pending_payment hari ini.
 * Dipanggil di dalam transaksi setelah OrderNumberGenerator (advisory lock) sehingga checkout paralel terurut.
 */
class UniqueCodeAllocator
{
    public function __construct(private OrderCalculator $calculator, private CommerceSettings $settings)
    {
    }

    /** Apakah metode/setting mewajibkan kode unik. */
    public function requiredFor(?\App\Models\PaymentMethod $method): bool
    {
        return $method !== null && $method->isManualTransfer() && (bool) $this->settings->get('unique_code_enabled');
    }

    /**
     * @param  string  $seedSource  mis. "{userId}|{number}" agar deterministik per order
     * @param  int|null  $excludeOrderId  order yang sedang dihitung ulang (ganti metode bayar)
     */
    public function allocate(string $seedSource, ?int $excludeOrderId = null): int
    {
        $used = Order::query()
            ->where('status', Order::STATUS_PENDING_PAYMENT)
            ->where('unique_code', '>', 0)
            ->whereDate('created_at', now()->setTimezone(config('app.timezone'))->toDateString())
            ->when($excludeOrderId, fn ($q) => $q->where('id', '!=', $excludeOrderId))
            ->pluck('unique_code')
            ->map(fn ($c) => (int) $c)
            ->all();

        $seed = crc32($seedSource);
        for ($i = 0; $i < 999; $i++) {
            $code = $this->calculator->uniqueCodeFor($seed + $i);
            if (! in_array($code, $used, true)) {
                return $code;
            }
        }

        // Semua 999 kode terpakai hari ini: kembalikan kode dari seed (admin mencocokkan lewat nomor order).
        return $this->calculator->uniqueCodeFor($seed);
    }
}
