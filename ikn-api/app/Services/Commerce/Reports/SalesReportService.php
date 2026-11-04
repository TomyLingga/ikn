<?php

namespace App\Services\Commerce\Reports;

use App\Http\Resources\OrderSummaryResource;
use App\Models\Order;
use App\Models\OrderItem;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Laporan penjualan (kontrak 11.1, ASUMSI A-24): agregasi on-the-fly dari orders.paid_at, status ≥ paid
 * (cancelled/expired tidak dihitung). Rentang inklusif di zona aplikasi; CSV untuk unduhan.
 * Agregat lama (summary, byMonth, byProduct) hanya order IDR (ASUMSI A-86); `byCurrency` memberi total per
 * mata uang dengan filter yang sama (Phase E6). Daftar order dan CSV memuat semua mata uang, tiap baris
 * membawa `currency` dan angkanya dalam satuan terkecil mata uang itu. Rincian tambahan (comparison, trend,
 * byCategory, topCustomers, byRegion, byPaymentMethod, byDeliveryTerm, funnel) lewat SalesBreakdowns, juga IDR.
 */
class SalesReportService
{
    public const MAX_ORDERS = 1000;

    /** @param  array{from: Carbon, to: Carbon, year: int, month: ?int}  $period */
    public function build(array $period): array
    {
        $query = $this->query($period);
        $allCurrencies = $this->query($period, null);

        $summaryRow = (clone $query)->select(
            DB::raw('COUNT(*) AS orders'),
            DB::raw('COALESCE(SUM(grand_total), 0) AS revenue'),
            DB::raw('COALESCE(SUM(subtotal), 0) AS subtotal'),
            DB::raw('COALESCE(SUM(discount_total), 0) AS discount'),
            DB::raw('COALESCE(SUM(shipping_total), 0) AS shipping'),
            DB::raw('COALESCE(SUM(fee_total), 0) AS fees'),
            DB::raw('COALESCE(SUM(tax_total), 0) AS tax')
        )->first();

        $orderIds = (clone $query)->select('id');
        $items = (int) OrderItem::whereIn('order_id', $orderIds)->sum('qty');
        $orders = (int) $summaryRow->orders;
        $revenue = Money::toInt($summaryRow->revenue);

        $summary = [
            'orders' => $orders,
            'revenue' => $revenue,
            'avgOrder' => $orders > 0 ? Money::round($revenue / $orders) : 0,
            'items' => $items,
            'subtotal' => Money::toInt($summaryRow->subtotal),
            'discount' => Money::toInt($summaryRow->discount),
            'shipping' => Money::toInt($summaryRow->shipping),
            'fees' => Money::toInt($summaryRow->fees),
            'tax' => Money::toInt($summaryRow->tax),
            // alias nama lama di FE mock
            'orderCount' => $orders,
            'paidCount' => $orders,
            'totalPaid' => $revenue,
            'itemsSold' => $items,
        ];

        $byMonthRows = (clone $query)
            ->select(DB::raw('EXTRACT(YEAR FROM paid_at)::int AS y'), DB::raw('EXTRACT(MONTH FROM paid_at)::int AS m'), DB::raw('COUNT(*) AS orders'), DB::raw('COALESCE(SUM(grand_total), 0) AS total'))
            ->groupBy('y', 'm')->orderBy('y')->orderBy('m')->get();
        $names = __('commerce.months', [], 'id');
        $byMonth = $byMonthRows->map(fn ($row) => [
            'ym' => sprintf('%04d-%02d', (int) $row->y, (int) $row->m),
            'month' => $names[(int) $row->m - 1] ?? (string) $row->m,
            'monthIndex' => (int) $row->m,
            'year' => (int) $row->y,
            'total' => Money::toInt($row->total),
            'orders' => (int) $row->orders,
        ])->values()->all();

        $byProduct = OrderItem::whereIn('order_id', $orderIds)
            ->select('product_id', DB::raw('SUM(qty) AS qty'), DB::raw('COALESCE(SUM(line_total - discount_amount), 0) AS revenue'), DB::raw('COUNT(DISTINCT order_id) AS orders'))
            ->groupBy('product_id')->orderByDesc('revenue')->get()
            ->map(function ($row) {
                $sample = OrderItem::where('product_id', $row->product_id)->orderByDesc('id')->first();
                $snapshot = $sample?->product_snapshot ?? [];

                return [
                    'productId' => (int) $row->product_id,
                    'productSlug' => $snapshot['slug'] ?? null,
                    'code' => $snapshot['code'] ?? null,
                    'name' => $sample ? $sample->productName() : ['id' => '', 'en' => ''],
                    'qty' => (int) $row->qty,
                    'orders' => (int) $row->orders,
                    'revenue' => Money::toInt($row->revenue),
                ];
            })->values()->all();

        $list = (clone $allCurrencies)->with(OrderSummaryResource::eager())->orderByDesc('paid_at')->orderByDesc('id')->limit(self::MAX_ORDERS)->get();

        // Rincian tambahan (2026-11-04, additive): pembanding periode sebelumnya, tren dalam rentang, dan rincian
        // per kategori/pelanggan/wilayah/metode bayar/serah terima, plus kohort order dibuat (konversi & batal).
        $previous = $this->previousPeriod($period);
        $prev = $this->query($previous)->select(DB::raw('COUNT(*) AS orders'), DB::raw('COALESCE(SUM(grand_total), 0) AS revenue'))->toBase()->first();
        $prevOrders = (int) $prev->orders;
        $prevRevenue = Money::toInt($prev->revenue);
        $prevItems = (int) OrderItem::whereIn('order_id', $this->query($previous)->select('id'))->sum('qty');
        $prevAvg = $prevOrders > 0 ? Money::round($prevRevenue / $prevOrders) : 0;

        return [
            'currency' => Money::CURRENCY_IDR,
            'period' => [
                'from' => $period['from']->toApiString(),
                'to' => $period['to']->toApiString(),
                'year' => $period['year'],
                'month' => $period['month'],
            ],
            'summary' => $summary,
            'byCurrency' => $this->byCurrency($allCurrencies),
            'byMonth' => $byMonth,
            'byProduct' => $byProduct,
            'comparison' => [
                'from' => $previous['from']->toApiString(),
                'to' => $previous['to']->toApiString(),
                'orders' => $prevOrders,
                'revenue' => $prevRevenue,
                'avgOrder' => $prevAvg,
                'items' => $prevItems,
                'changePct' => [
                    'orders' => SalesBreakdowns::changePct($orders, $prevOrders),
                    'revenue' => SalesBreakdowns::changePct($revenue, $prevRevenue),
                    'avgOrder' => SalesBreakdowns::changePct($summary['avgOrder'], $prevAvg),
                    'items' => SalesBreakdowns::changePct($items, $prevItems),
                ],
            ],
            'trend' => SalesBreakdowns::trend($query, $period['from'], $period['to']),
            'byCategory' => SalesBreakdowns::byCategory($query),
            'topCustomers' => SalesBreakdowns::topCustomers($query, 10),
            'byRegion' => SalesBreakdowns::byRegion($query),
            'byPaymentMethod' => SalesBreakdowns::byPaymentMethod($query),
            'byDeliveryTerm' => SalesBreakdowns::byDeliveryTerm($query),
            'funnel' => SalesBreakdowns::funnel($period['from'], $period['to']),
            'orders' => OrderSummaryResource::collection($list)->resolve(),
        ];
    }

    /**
     * Total per mata uang dengan filter paid_at/status yang sama (Phase E6): hanya mata uang yang punya order
     * dalam rentang, urut sesuai Money::CURRENCIES (IDR dulu). `revenue`/`averageOrder` dalam satuan terkecil
     * mata uang baris itu; `paidOrders` = `orders` (laporan ini hanya menghitung order yang dibayar, sama
     * seperti summary.orders/paidCount).
     *
     * @return array<int, array{currency: string, orders: int, revenue: int, paidOrders: int, averageOrder: int}>
     */
    private function byCurrency(Builder $query): array
    {
        $rows = (clone $query)
            ->select('currency', DB::raw('COUNT(*) AS orders'), DB::raw('COALESCE(SUM(grand_total), 0) AS revenue'))
            ->groupBy('currency')->toBase()->get()
            ->keyBy(fn ($row) => Money::normalizeCurrency($row->currency));

        $out = [];
        foreach (Money::CURRENCIES as $currency) {
            $row = $rows->get($currency);
            if ($row === null || (int) $row->orders === 0) {
                continue;
            }
            $orders = (int) $row->orders;
            $revenue = (int) Money::toMinor($row->revenue, $currency);
            $out[] = [
                'currency' => $currency,
                'orders' => $orders,
                'revenue' => $revenue,
                'paidOrders' => $orders,
                'averageOrder' => intdiv($revenue, $orders),
            ];
        }

        return $out;
    }

    /**
     * CSV (UTF-8, header baris pertama) untuk unduhan: satu baris per order paid dalam rentang, semua mata uang;
     * kolom uang dalam satuan terkecil mata uang di kolom `currency` (IDR rupiah, USD sen).
     */
    public function csv(array $period): string
    {
        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, ['number', 'invoiceNumber', 'paidAt', 'status', 'customer', 'company', 'email', 'currency', 'items', 'subtotal', 'discount', 'shipping', 'fee', 'tax', 'uniqueCode', 'grandTotal', 'paymentMethod']);

        $orders = $this->query($period, null)->with(['items', 'payments'])->orderBy('paid_at')->orderBy('id')->cursor();
        foreach ($orders as $order) {
            fputcsv($handle, [
                $order->number,
                $order->invoice_number,
                optional($order->paid_at)->toApiString(),
                $order->status,
                $order->customerName(),
                $order->customerCompany(),
                $order->customerEmail(),
                $order->currencyCode(),
                (int) $order->items->sum('qty'),
                $order->subtotalInt(),
                $order->discountTotalInt(),
                $order->shippingTotalInt(),
                $order->feeTotalInt(),
                $order->taxTotalInt(),
                (int) $order->unique_code,
                $order->grandTotalInt(),
                $order->latestPayment()?->method,
            ]);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return "\xEF\xBB\xBF".$csv;
    }

    public function csvFilename(array $period): string
    {
        return sprintf('sales-report-%s-%s.csv', $period['from']->format('Ymd'), $period['to']->format('Ymd'));
    }

    /**
     * Periode pembanding: tahun sebelumnya (mode tahun), bulan sebelumnya (mode bulan), atau rentang sepanjang
     * yang sama tepat sebelum `from` (mode rentang tanggal).
     *
     * @return array{from: Carbon, to: Carbon}
     */
    private function previousPeriod(array $period): array
    {
        $from = $period['from']->copy();
        $to = $period['to']->copy();
        $isCalendar = $from->isSameDay($from->copy()->startOfMonth()) && $to->isSameDay($to->copy()->endOfMonth());
        if ($period['month'] !== null || ($isCalendar && $from->isSameMonth($to))) {
            $start = $from->copy()->subMonthNoOverflow()->startOfMonth();

            return ['from' => $start, 'to' => $start->copy()->endOfMonth()];
        }
        if ($isCalendar && $from->month === 1 && $to->month === 12 && $from->year === $to->year) {
            return ['from' => $from->copy()->subYear()->startOfYear(), 'to' => $from->copy()->subYear()->endOfYear()];
        }
        $days = $from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1;

        return ['from' => $from->copy()->subDays($days)->startOfDay(), 'to' => $from->copy()->subDay()->endOfDay()];
    }

    /** Order dibayar dalam rentang; $currency null = semua mata uang (daftar, CSV, byCurrency). */
    private function query(array $period, ?string $currency = Money::CURRENCY_IDR): Builder
    {
        $query = Order::revenue()->whereBetween('paid_at', [$period['from'], $period['to']]);

        return $currency === null ? $query : $query->inCurrency($currency);
    }
}
