<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\Commerce\CommerceSettings;
use App\Services\Commerce\OrderNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

// Tiap 15 menit: pengingat email N jam (setting reminder_hours_before_due) sebelum batas waktu, sekali per order
// (reminder_sent_at). Setting 0 = nonaktif.
class OrdersRemind extends Command
{
    protected $signature = 'orders:remind';

    protected $description = 'Send a one-time payment reminder to pending_payment orders approaching their deadline';

    public function handle(CommerceSettings $settings, OrderNotifier $notifier): int
    {
        $hours = (int) $settings->get('reminder_hours_before_due');
        if ($hours <= 0) {
            $this->info('Reminder disabled (reminder_hours_before_due = 0).');

            return self::SUCCESS;
        }

        $now = now();
        $query = Order::where('status', Order::STATUS_PENDING_PAYMENT)
            ->whereNull('reminder_sent_at')
            ->whereNotNull('payment_due_at')
            ->where('payment_due_at', '>', $now)
            ->where('payment_due_at', '<=', $now->copy()->addHours($hours))
            ->orderBy('id');

        $count = 0;
        foreach ($query->cursor() as $order) {
            // Tandai dulu secara atomik agar dua proses tidak mengirim dua kali.
            $marked = DB::table('orders')->where('id', $order->id)->whereNull('reminder_sent_at')
                ->update(['reminder_sent_at' => $now->copy()->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s')]);
            if ($marked === 0) {
                continue;
            }
            $order->reminder_sent_at = $now;
            $notifier->paymentReminder($order);
            $count++;
            $this->line('reminded '.$order->number);
        }

        $this->info(sprintf('%d reminder(s) sent.', $count));

        return self::SUCCESS;
    }
}
