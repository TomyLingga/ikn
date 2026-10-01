<?php

namespace App\Services\Commerce;

use App\Models\Order;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Nomor invoice format klien: {prefix}/{urut}/{bulan Romawi}/{tahun}, mis. PMS/X/INV/RA/77/IV/2026
 * (ASUMSI A-7 diperbarui 2026-10-01). Urutan dimulai dari 1 tiap bulan (tanpa nol di depan), prefix dari
 * pengaturan commerce `invoice_prefix`. Diterbitkan saat order paid; dipanggil di dalam transaksi.
 */
class InvoiceNumberGenerator
{
    public const LOCK_KEY = 'invoice_number';

    public const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

    public function __construct(private CommerceSettings $settings)
    {
    }

    public function next(?Carbon $date = null): string
    {
        $date = ($date ?? now())->copy()->setTimezone(config('app.timezone'));
        $suffix = '/'.self::ROMAN_MONTHS[$date->month - 1].'/'.$date->format('Y');
        $prefix = trim((string) $this->settings->get('invoice_prefix'), '/ ');

        DB::statement("SELECT pg_advisory_xact_lock(hashtext(?))", [self::LOCK_KEY]);

        // Urutan bulan ini = nomor terbesar yang berakhiran /{Romawi}/{tahun}, apa pun prefix-nya (prefix bisa diubah admin).
        $sequence = 0;
        foreach (Order::where('invoice_number', 'like', '%'.$suffix)->pluck('invoice_number') as $existing) {
            if (preg_match('#/(\d+)'.preg_quote($suffix, '#').'$#', $existing, $m)) {
                $sequence = max($sequence, (int) $m[1]);
            }
        }

        return $prefix.'/'.($sequence + 1).$suffix;
    }
}
