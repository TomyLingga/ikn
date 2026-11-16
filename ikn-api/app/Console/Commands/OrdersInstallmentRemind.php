<?php

namespace App\Console\Commands;

use App\Services\Commerce\InstallmentService;
use Illuminate\Console\Command;

// Harian (ASUMSI A-97): pengingat termin lanjutan yang sedang ditagih. Sekali saat jatuh tempo tinggal
// installment_remind_before_days hari, lalu tiap installment_remind_overdue_days hari selama terlambat (0 = mati).
// Idempoten: dijalankan ulang pada hari yang sama tidak mengirim dua kali. Termin tidak pernah membatalkan order.
class OrdersInstallmentRemind extends Command
{
    protected $signature = 'orders:installment-remind';

    protected $description = 'Remind customers about due and overdue payment installments';

    public function handle(InstallmentService $installments): int
    {
        $sent = $installments->sendDueReminders(now());

        $this->info(sprintf('%d reminder(s) sent before due, %d overdue.', $sent['before'], $sent['overdue']));

        return self::SUCCESS;
    }
}
