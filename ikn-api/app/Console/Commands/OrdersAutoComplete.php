<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Services\Commerce\CommerceSettings;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Console\Command;
use Throwable;

// Harian: delivered lebih dari auto_complete_days hari → completed (actor system). Setting 0 = nonaktif.
class OrdersAutoComplete extends Command
{
    protected $signature = 'orders:auto-complete';

    protected $description = 'Complete delivered orders automatically after the configured number of days';

    public function handle(CommerceSettings $settings, OrderStateMachine $stateMachine): int
    {
        $days = (int) $settings->get('auto_complete_days');
        if ($days <= 0) {
            $this->info('Auto-complete disabled (auto_complete_days = 0).');

            return self::SUCCESS;
        }

        $query = Order::where('status', Order::STATUS_DELIVERED)
            ->whereNotNull('delivered_at')
            ->where('delivered_at', '<=', now()->subDays($days))
            ->orderBy('id');

        $count = 0;
        foreach ($query->cursor() as $order) {
            try {
                $stateMachine->transition($order, Order::STATUS_COMPLETED, null, ['actorType' => OrderStatusHistory::ACTOR_SYSTEM, 'days' => $days]);
                $count++;
                $this->line('completed '.$order->number);
            } catch (Throwable $e) {
                $this->warn('skip '.$order->number.': '.$e->getMessage());
            }
        }

        $this->info(sprintf('%d order(s) auto-completed.', $count));

        return self::SUCCESS;
    }
}
