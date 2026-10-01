<?php

namespace App\Services\Commerce\Reports;

use App\Http\Resources\OrderSummaryResource;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Services\Auth\ModuleAccess;
use App\Services\Chat\ChatService;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard admin (kontrak 11.1, Phase 10): statistik, order terbaru, order yang butuh tindakan,
 * grafik penjualan 12 bulan dari paid_at (order cancelled/expired tidak dihitung, ASUMSI A-24).
 * Additive v2 keys: period, kpis (month-to-date vs same span last month), workQueue (module-aware),
 * topProducts, lowStock, paymentDue.
 */
class DashboardService
{
    /** Low stock: available below max(moq x LOW_STOCK_MOQ_FACTOR, LOW_STOCK_MIN). */
    public const LOW_STOCK_MIN = 50;

    public const LOW_STOCK_MOQ_FACTOR = 10;

    /** Unpaid orders whose payment deadline falls within this many hours count as "due soon". */
    public const PAYMENT_DUE_SOON_HOURS = 48;

    private const LIST_LIMIT = 6;

    public function __construct(private ModuleAccess $access, private ChatService $chat)
    {
    }

    public function build(int $year, ?User $viewer = null): array
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
            'period' => $this->periodPayload($now),
            'kpis' => $this->kpis($now),
            'workQueue' => $this->workQueue($now, $viewer),
            'topProducts' => $this->topProducts($monthStart, $now),
            'lowStock' => $this->lowStock(),
            'paymentDue' => $this->paymentDue($now),
        ];
    }

    /**
     * Month-to-date vs the same elapsed span of the previous month (fair comparison mid-month).
     *
     * @return array{0: Carbon, 1: Carbon, 2: Carbon} [monthStart, previousStart, previousEnd]
     */
    private function periods(Carbon $now): array
    {
        $monthStart = $now->copy()->startOfMonth();
        $prevStart = $monthStart->copy()->subMonthNoOverflow();
        $prevEnd = $prevStart->copy()->addSeconds($monthStart->diffInSeconds($now));
        $prevMonthEnd = $monthStart->copy()->subSecond();
        if ($prevEnd->gt($prevMonthEnd)) {
            $prevEnd = $prevMonthEnd;
        }

        return [$monthStart, $prevStart, $prevEnd];
    }

    private function periodPayload(Carbon $now): array
    {
        [$monthStart, $prevStart, $prevEnd] = $this->periods($now);

        return [
            'from' => $monthStart->toApiString(),
            'to' => $now->toApiString(),
            'previousFrom' => $prevStart->toApiString(),
            'previousTo' => $prevEnd->toApiString(),
        ];
    }

    /** Revenue, paid orders, average order value, new customers: current vs previous period (2 queries). */
    private function kpis(Carbon $now): array
    {
        [$monthStart, $prevStart, $prevEnd] = $this->periods($now);

        $sales = Order::revenue()
            ->where('paid_at', '>=', $prevStart)->where('paid_at', '<=', $now)
            ->selectRaw(
                'COALESCE(SUM(grand_total) FILTER (WHERE paid_at >= ?), 0) AS cur_total, '
                .'COUNT(*) FILTER (WHERE paid_at >= ?) AS cur_orders, '
                .'COALESCE(SUM(grand_total) FILTER (WHERE paid_at <= ?), 0) AS prev_total, '
                .'COUNT(*) FILTER (WHERE paid_at <= ?) AS prev_orders',
                [$monthStart, $monthStart, $prevEnd, $prevEnd]
            )->toBase()->first();

        $customers = User::customers()
            ->where('created_at', '>=', $prevStart)->where('created_at', '<=', $now)
            ->selectRaw(
                'COUNT(*) FILTER (WHERE created_at >= ?) AS cur, COUNT(*) FILTER (WHERE created_at <= ?) AS prev',
                [$monthStart, $prevEnd]
            )->toBase()->first();

        $curTotal = Money::toInt($sales->cur_total ?? 0);
        $prevTotal = Money::toInt($sales->prev_total ?? 0);
        $curOrders = (int) ($sales->cur_orders ?? 0);
        $prevOrders = (int) ($sales->prev_orders ?? 0);

        return [
            'revenue' => self::metric($curTotal, $prevTotal),
            'paidOrders' => self::metric($curOrders, $prevOrders),
            'avgOrderValue' => self::metric(
                $curOrders > 0 ? intdiv($curTotal, $curOrders) : 0,
                $prevOrders > 0 ? intdiv($prevTotal, $prevOrders) : 0
            ),
            'newCustomers' => self::metric((int) ($customers->cur ?? 0), (int) ($customers->prev ?? 0)),
        ];
    }

    /** @return array{current:int, previous:int, changePct:float|null} changePct is null when previous = 0. */
    private static function metric(int $current, int $previous): array
    {
        return [
            'current' => $current,
            'previous' => $previous,
            'changePct' => $previous > 0 ? round(($current - $previous) / $previous * 100, 1) : null,
        ];
    }

    /**
     * Work queue counters; null = viewer lacks the module (same rule as Admin\BadgeController).
     * Without a viewer (internal use) every counter is returned.
     */
    private function workQueue(Carbon $now, ?User $viewer): array
    {
        $allows = fn (string $module) => $viewer === null || $this->access->allows($viewer, $module);

        $byStatus = null;
        $overdue = null;
        if ($allows('orders')) {
            $byStatus = Order::whereIn('status', Order::IN_PROGRESS_STATUSES)
                ->select('status', DB::raw('COUNT(*) AS c'))->groupBy('status')->pluck('c', 'status');
            $overdue = Order::where('status', Order::STATUS_PENDING_PAYMENT)
                ->whereNotNull('payment_due_at')->where('payment_due_at', '<', $now)->count();
        }
        $orders = fn (string $status) => $byStatus === null ? null : (int) ($byStatus[$status] ?? 0);

        return [
            'paymentsToVerify' => $allows('payments')
                ? Payment::where('status', Payment::STATUS_AWAITING_VERIFICATION)->count()
                : null,
            'ordersToProcess' => $orders(Order::STATUS_PAID),
            'ordersToShip' => $orders(Order::STATUS_PROCESSING),
            'ordersInTransit' => $orders(Order::STATUS_SHIPPED),
            'ordersDelivered' => $orders(Order::STATUS_DELIVERED),
            'paymentsOverdue' => $overdue,
            'customersToApprove' => $allows('customers')
                ? User::customers()->where('status', User::STATUS_PENDING)->count()
                : null,
            'unreadChats' => $allows('chat') ? $this->chat->adminUnreadConversations() : null,
        ];
    }

    /** Best sellers by revenue this month (paid_at); name/code from the latest order snapshot (2 queries). */
    private function topProducts(Carbon $monthStart, Carbon $now): array
    {
        $rows = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereNotNull('orders.paid_at')
            ->whereIn('orders.status', Order::PAID_STATUSES)
            ->where('orders.paid_at', '>=', $monthStart)->where('orders.paid_at', '<=', $now)
            ->groupBy('order_items.product_id')
            ->select(
                'order_items.product_id',
                DB::raw('MAX(order_items.id) AS sample_id'),
                DB::raw('SUM(order_items.qty) AS qty'),
                DB::raw('COUNT(DISTINCT order_items.order_id) AS orders'),
                DB::raw('COALESCE(SUM(order_items.line_total - order_items.discount_amount), 0) AS revenue')
            )
            ->orderByDesc('revenue')->orderBy('order_items.product_id')
            ->limit(5)->toBase()->get();

        if ($rows->isEmpty()) {
            return [];
        }

        $samples = OrderItem::whereIn('id', $rows->pluck('sample_id')->all())->get()->keyBy('id');

        return $rows->map(function ($row) use ($samples) {
            $sample = $samples->get((int) $row->sample_id);
            $snapshot = $sample?->product_snapshot ?? [];

            return [
                'productId' => (int) $row->product_id,
                'productSlug' => $snapshot['slug'] ?? null,
                'code' => $snapshot['code'] ?? null,
                'name' => $sample ? $sample->productName() : ['id' => '', 'en' => ''],
                'image' => $snapshot['image'] ?? null,
                'unit' => $snapshot['unit'] ?? null,
                'qty' => (int) $row->qty,
                'orders' => (int) $row->orders,
                'revenue' => Money::toInt($row->revenue),
            ];
        })->values()->all();
    }

    /** Fixed-price, stock-tracked products whose available stock is under the threshold (read only). */
    private function lowStock(): array
    {
        $available = '(stock_qty - reserved_qty)';
        $threshold = sprintf('GREATEST(COALESCE(moq, 1) * %d, %d)', self::LOW_STOCK_MOQ_FACTOR, self::LOW_STOCK_MIN);

        $query = Product::query()
            ->where('price_mode', Product::PRICE_MODE_FIXED)
            ->where('stock_status', '!=', Product::STOCK_MADE_TO_ORDER)
            ->whereRaw("{$available} < {$threshold}");

        $total = (clone $query)->count();
        $items = $query->with('images.media')
            ->orderByRaw("{$available} ASC")->orderBy('id')
            ->limit(self::LIST_LIMIT)->get();

        return [
            'total' => $total,
            'rule' => ['min' => self::LOW_STOCK_MIN, 'moqFactor' => self::LOW_STOCK_MOQ_FACTOR],
            'items' => $items->map(fn (Product $product) => [
                'id' => $product->id,
                'slug' => $product->slug,
                'code' => $product->code,
                'name' => $product->name,
                'image' => $product->primaryImageUrl(),
                'unit' => $product->unit,
                'moq' => (int) $product->moq,
                'stock' => (int) $product->stock_qty,
                'reserved' => (int) $product->reserved_qty,
                'available' => $product->available,
                'threshold' => max(((int) ($product->moq ?: 1)) * self::LOW_STOCK_MOQ_FACTOR, self::LOW_STOCK_MIN),
                'stockStatus' => $product->stock_status,
                'isPublished' => (bool) $product->is_published,
            ])->values()->all(),
        ];
    }

    /** Unpaid orders past or near their payment deadline (overdue first). */
    private function paymentDue(Carbon $now): array
    {
        $soon = $now->copy()->addHours(self::PAYMENT_DUE_SOON_HOURS);
        $query = Order::where('status', Order::STATUS_PENDING_PAYMENT)
            ->whereNotNull('payment_due_at')->where('payment_due_at', '<=', $soon);

        $counts = (clone $query)
            ->selectRaw('COUNT(*) FILTER (WHERE payment_due_at < ?) AS overdue, COUNT(*) FILTER (WHERE payment_due_at >= ?) AS soon', [$now, $now])
            ->toBase()->first();
        $items = $query->with(OrderSummaryResource::eager())
            ->orderBy('payment_due_at')->orderBy('id')->limit(self::LIST_LIMIT)->get();

        return [
            'overdue' => (int) ($counts->overdue ?? 0),
            'dueSoon' => (int) ($counts->soon ?? 0),
            'windowHours' => self::PAYMENT_DUE_SOON_HOURS,
            'items' => OrderSummaryResource::collection($items)->resolve(),
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
