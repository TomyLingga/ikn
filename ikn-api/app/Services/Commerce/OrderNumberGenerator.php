<?php

namespace App\Services\Commerce;

use App\Models\Order;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

// Nomor order IKN-YYYYMMDD-NNNNN (ASUMSI A-7), berurutan per hari. Harus dipanggil di dalam transaksi:
// pg_advisory_xact_lock menahan checkout paralel sampai transaksi pemanggil selesai (pola WbsCodeGenerator).
class OrderNumberGenerator
{
    public const LOCK_KEY = 'order_number';

    public function next(?Carbon $date = null): string
    {
        $date = ($date ?? now())->copy()->setTimezone(config('app.timezone'));
        $prefix = config('ikn.commerce.order_number_prefix', 'IKN').'-'.$date->format('Ymd').'-';

        DB::statement("SELECT pg_advisory_xact_lock(hashtext(?))", [self::LOCK_KEY]);

        $last = Order::where('number', 'like', $prefix.'%')->orderByDesc('number')->value('number');
        $sequence = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 5, '0', STR_PAD_LEFT);
    }
}
