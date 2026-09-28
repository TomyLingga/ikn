<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\Payment\PaymentService;
use Illuminate\Console\Command;
use Throwable;

// Tiap menit: pending_payment lewat payment_due_at → expired (release stok + voucher idempoten, email).
// payment_review dilewati (menunggu admin). Aman dijalankan berulang.
class OrdersExpire extends Command
{
    protected $signature = 'orders:expire {--dry-run : Hanya tampilkan order yang akan diekspirasi}';

    protected $description = 'Expire pending_payment orders past their payment deadline (release stock and voucher quota)';

    public function handle(PaymentService $payments): int
    {
        $query = Order::where('status', Order::STATUS_PENDING_PAYMENT)
            ->whereNotNull('payment_due_at')
            ->where('payment_due_at', '<', now())
            ->orderBy('id');

        $count = 0;
        $failed = 0;
        foreach ($query->cursor() as $order) {
            if ($this->option('dry-run')) {
                $this->line($order->number.' due '.$order->payment_due_at->toApiString());
                $count++;
                continue;
            }
            try {
                $payments->expire($order);
                $count++;
                $this->line('expired '.$order->number);
            } catch (Throwable $e) {
                // Order yang berubah status di antara query dan transisi (mis. baru dibayar) dilewati.
                $failed++;
                $this->warn('skip '.$order->number.': '.$e->getMessage());
            }
        }

        $this->info(sprintf('%d order(s) expired, %d skipped.', $count, $failed));

        return self::SUCCESS;
    }
}
