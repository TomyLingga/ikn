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
 */
class SalesReportService
{
    public const MAX_ORDERS = 1000;

    /** @param  array{from: Carbon, to: Carbon, year: int, month: ?int}  $period */
    public function build(array $period): array
    {
        $query = $this->query($period);

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

        $list = (clone $query)->with(OrderSummaryResource::eager())->orderByDesc('paid_at')->orderByDesc('id')->limit(self::MAX_ORDERS)->get();

        return [
            'period' => [
                'from' => $period['from']->toApiString(),
                'to' => $period['to']->toApiString(),
                'year' => $period['year'],
                'month' => $period['month'],
            ],
            'summary' => $summary,
            'byMonth' => $byMonth,
            'byProduct' => $byProduct,
            'orders' => OrderSummaryResource::collection($list)->resolve(),
        ];
    }

    /** CSV (UTF-8, header baris pertama) untuk unduhan: satu baris per order paid dalam rentang. */
    public function csv(array $period): string
    {
        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, ['number', 'invoiceNumber', 'paidAt', 'status', 'customer', 'company', 'email', 'items', 'subtotal', 'discount', 'shipping', 'fee', 'tax', 'uniqueCode', 'grandTotal', 'paymentMethod']);

        $orders = $this->query($period)->with(['items', 'payments'])->orderBy('paid_at')->orderBy('id')->cursor();
        foreach ($orders as $order) {
            fputcsv($handle, [
                $order->number,
                $order->invoice_number,
                optional($order->paid_at)->toApiString(),
                $order->status,
                $order->customerName(),
                $order->customerCompany(),
                $order->customerEmail(),
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

    private function query(array $period): Builder
    {
        return Order::revenue()->whereBetween('paid_at', [$period['from'], $period['to']]);
    }
}
