<?php

namespace App\Services\Commerce\Reports;

use App\Http\Resources\OrderSummaryResource;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard admin (kontrak 11.1, Phase 10): statistik, order terbaru, order yang butuh tindakan,
 * grafik penjualan 12 bulan dari paid_at (order cancelled/expired tidak dihitung, ASUMSI A-24).
 */
class DashboardService
{
    public function build(int $year): array
    {
        $tz = config('app.timezone');
        $now = now()->setTimezone($tz);
        $todayStart = $now->copy()->startOfDay();
        $monthStart = $now->copy()->startOfMonth();

        $revenueThisMonth = Order::revenue()
            ->where('paid_at', '>=', $monthStart)
            ->where('paid_at', '<=', $monthStart->copy()->endOfMonth())
            ->sum('grand_total');

        $awaitingVerification = Payment::where('status', Payment::STATUS_AWAITING_VERIFICATION)->count();

        $stats = [
            'ordersToday' => Order::where('created_at', '>=', $todayStart)->count(),
            'ordersThisMonth' => Order::where('created_at', '>=', $monthStart)->count(),
            'awaitingVerification' => $awaitingVerification,
            'pendingVerification' => $awaitingVerification, // alias nama lama di FE mock
            'revenueThisMonth' => Money::toInt($revenueThisMonth),
            'pendingCustomers' => User::customers()->where('status', User::STATUS_PENDING)->count(),
            'activeCustomers' => User::customers()->where('status', User::STATUS_ACTIVE)->count(),
        ];

        $recent = Order::with(OrderSummaryResource::eager())->orderByDesc('created_at')->orderByDesc('id')->limit(10)->get();
        $needsAction = Order::with(OrderSummaryResource::eager())
            ->whereIn('status', [Order::STATUS_PAYMENT_REVIEW, Order::STATUS_PAID, Order::STATUS_PROCESSING])
            ->orderByRaw("CASE status WHEN 'payment_review' THEN 0 WHEN 'paid' THEN 1 ELSE 2 END")
            ->orderBy('created_at')->limit(10)->get();

        $chart = $this->salesChart($year);

        return [
            'stats' => $stats,
            'recentOrders' => OrderSummaryResource::collection($recent)->resolve(),
            'needsAction' => OrderSummaryResource::collection($needsAction)->resolve(),
            'salesChart' => $chart,
            'salesByMonth' => $chart, // alias nama lama di FE mock
            'year' => $year,
        ];
    }

    /** @return array<int, array{ym:string, month:string, monthIndex:int, year:int, total:int, orders:int}> */
    public function salesChart(int $year): array
    {
        return self::monthlySeries($year, self::monthlyTotals($year));
    }

    /** Agregat per bulan (paid_at, zona aplikasi) untuk satu tahun: [monthIndex => [total, orders]]. */
    public static function monthlyTotals(int $year): array
    {
        $tz = config('app.timezone');
        $from = now()->setTimezone($tz)->setDate($year, 1, 1)->startOfDay();
        $to = $from->copy()->endOfYear();

        $rows = Order::revenue()
            ->whereBetween('paid_at', [$from, $to])
            ->select(DB::raw('EXTRACT(MONTH FROM paid_at)::int AS m'), DB::raw('COUNT(*) AS orders'), DB::raw('COALESCE(SUM(grand_total), 0) AS total'))
            ->groupBy('m')
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $out[(int) $row->m] = ['total' => Money::toInt($row->total), 'orders' => (int) $row->orders];
        }

        return $out;
    }

    public static function monthlySeries(int $year, array $totals): array
    {
        $names = __('commerce.months', [], 'id');
        $series = [];
        for ($m = 1; $m <= 12; $m++) {
            $series[] = [
                'ym' => sprintf('%04d-%02d', $year, $m),
                'month' => $names[$m - 1] ?? (string) $m,
                'monthIndex' => $m,
                'year' => $year,
                'total' => $totals[$m]['total'] ?? 0,
                'orders' => $totals[$m]['orders'] ?? 0,
            ];
        }

        return $series;
    }
}
