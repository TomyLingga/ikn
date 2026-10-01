<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\OrderSummaryResource;
use App\Models\Order;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * GET /customer/dashboard?from&to: ringkasan portal customer.
 * - Rentang tanggal (opsional; tanpa rentang = sepanjang waktu) berlaku untuk totalOrders, completed,
 *   transactionValue, dan recentOrders.
 * - awaitingPayment, inProgress, toReview, dan actionOrders selalu sepanjang waktu: itu pekerjaan yang masih
 *   terbuka, jadi tidak boleh tersembunyi oleh filter tanggal.
 * - monthly = belanja 6 bulan terakhir (paid_at) untuk grafik kecil.
 */
class DashboardController extends ApiController
{
    private const MONTHS = 6;

    public function show(Request $request)
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $user = $request->user();
        $tz = config('app.timezone');
        $from = $request->query('from') ? Carbon::parse($request->query('from'), $tz)->startOfDay() : null;
        $to = $request->query('to') ? Carbon::parse($request->query('to'), $tz)->endOfDay() : null;

        $base = Order::ownedBy($user);
        $ranged = fn (string $column) => (clone $base)
            ->when($from, fn ($q) => $q->where($column, '>=', $from))
            ->when($to, fn ($q) => $q->where($column, '<=', $to));

        $recent = $ranged('created_at')->with(OrderSummaryResource::eager())
            ->orderByDesc('created_at')->orderByDesc('id')->limit(5)->get();

        // Yang perlu ditindak customer lebih dulu: bayar, lalu konfirmasi terima, lalu yang sedang diproses.
        $action = (clone $base)->with(OrderSummaryResource::eager())
            ->whereIn('status', array_merge(Order::AWAITING_PAYMENT_STATUSES, Order::IN_PROGRESS_STATUSES))
            ->orderByRaw("CASE status WHEN 'pending_payment' THEN 0 WHEN 'shipped' THEN 1 WHEN 'delivered' THEN 2 WHEN 'payment_review' THEN 3 ELSE 4 END")
            ->orderByDesc('created_at')->limit(6)->get();

        return $this->data([
            'range' => ['from' => $from?->toDateString(), 'to' => $to?->toDateString()],
            'totalOrders' => $ranged('created_at')->count(),
            'completed' => $ranged('created_at')->where('status', Order::STATUS_COMPLETED)->count(),
            'transactionValue' => Money::toInt($ranged('paid_at')->revenue()->sum('grand_total')),
            'awaitingPayment' => (clone $base)->whereIn('status', Order::AWAITING_PAYMENT_STATUSES)->count(),
            'inProgress' => (clone $base)->whereIn('status', Order::IN_PROGRESS_STATUSES)->count(),
            'toReview' => (clone $base)->awaitingReview()->count(),
            'actionOrders' => OrderSummaryResource::collection($action)->resolve(),
            'recentOrders' => OrderSummaryResource::collection($recent)->resolve(),
            'monthly' => $this->monthly($base, $tz),
            'account' => [
                'status' => $user->status,
                'rejectionReason' => $user->rejection_reason,
                'canOrder' => $user->isActive(),
            ],
        ]);
    }

    /** @return array<int, array{ym:string, month:string, monthIndex:int, year:int, total:int, orders:int}> */
    private function monthly($base, string $tz): array
    {
        $start = now()->setTimezone($tz)->startOfMonth()->subMonths(self::MONTHS - 1);
        $rows = (clone $base)->revenue()->where('paid_at', '>=', $start)->get(['paid_at', 'grand_total']);

        $totals = [];
        foreach ($rows as $row) {
            $ym = $row->paid_at->copy()->setTimezone($tz)->format('Y-m');
            $totals[$ym]['total'] = ($totals[$ym]['total'] ?? 0) + Money::toInt($row->grand_total);
            $totals[$ym]['orders'] = ($totals[$ym]['orders'] ?? 0) + 1;
        }

        $names = __('commerce.months', [], 'id');
        $series = [];
        for ($i = 0; $i < self::MONTHS; $i++) {
            $month = $start->copy()->addMonths($i);
            $ym = $month->format('Y-m');
            $series[] = [
                'ym' => $ym,
                'month' => $names[$month->month - 1] ?? (string) $month->month,
                'monthIndex' => $month->month,
                'year' => $month->year,
                'total' => $totals[$ym]['total'] ?? 0,
                'orders' => $totals[$ym]['orders'] ?? 0,
            ];
        }

        return $series;
    }
}
