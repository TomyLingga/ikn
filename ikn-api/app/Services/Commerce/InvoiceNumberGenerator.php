<?php

namespace App\Services\Commerce;

use App\Models\Order;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

// Nomor invoice INV/YYYY/MM/NNNNN (ASUMSI A-7), diterbitkan saat order paid. Dipanggil di dalam transaksi.
class InvoiceNumberGenerator
{
    public const LOCK_KEY = 'invoice_number';

    public function next(?Carbon $date = null): string
    {
        $date = ($date ?? now())->copy()->setTimezone(config('app.timezone'));
        $prefix = config('ikn.commerce.invoice_number_prefix', 'INV').'/'.$date->format('Y').'/'.$date->format('m').'/';

        DB::statement("SELECT pg_advisory_xact_lock(hashtext(?))", [self::LOCK_KEY]);

        $last = Order::where('invoice_number', 'like', $prefix.'%')->orderByDesc('invoice_number')->value('invoice_number');
        $sequence = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 5, '0', STR_PAD_LEFT);
    }
}
