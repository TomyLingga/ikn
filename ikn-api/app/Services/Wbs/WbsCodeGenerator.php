<?php

namespace App\Services\Wbs;

use App\Models\WbsReport;
use Illuminate\Support\Facades\DB;

// Kode laporan WBS-YYYYMM-NNNN, berurutan per bulan (ASUMSI A-21). Harus dipanggil di dalam transaksi.
class WbsCodeGenerator
{
    public function next(): string
    {
        $prefix = 'WBS-'.now()->format('Ym').'-';

        // Kunci advisory per transaksi agar dua laporan bersamaan tidak mendapat nomor sama.
        DB::statement("SELECT pg_advisory_xact_lock(hashtext('wbs_code'))");

        $last = WbsReport::where('code', 'like', $prefix.'%')->orderByDesc('code')->value('code');
        $sequence = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
