<?php

namespace App\Services\Commerce\Reports;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Rincian penjualan bersama untuk laporan penjualan dan dashboard admin (2026-11-04). Setiap metode menerima
 * query order yang SUDAH difilter (biasanya Order::revenue() + rentang paid_at + IDR) sehingga semua angka
 * mengikuti aturan yang sama dengan summary (ASUMSI A-24, A-86). Uang dalam rupiah bulat.
 */
class SalesBreakdowns
{
    /**
     * Deret waktu pendapatan per hari/minggu/bulan (paid_at, zona sesi DB = zona aplikasi), bucket kosong diisi 0.
     *
     * @return array{granularity: string, points: array<int, array{date: string, total: int, orders: int}>}
     */
    public static function trend(Builder $orders, Carbon $from, Carbon $to, ?string $granularity = null): array
    {
        $days = $from->diffInDays($to) + 1;
        $granularity ??= $days <= 62 ? 'day' : ($days <= 400 ? 'week' : 'month');

        $rows = (clone $orders)
            ->select(DB::raw("date_trunc('{$granularity}', paid_at)::date AS bucket"), DB::raw('COUNT(*) AS orders'), DB::raw('COALESCE(SUM(grand_total), 0) AS total'))
            ->groupBy('bucket')->toBase()->get()
            ->keyBy(fn ($row) => Carbon::parse($row->bucket)->toDateString());

        $cursor = $from->copy()->startOfDay();
        $cursor = match ($granularity) {
            'week' => $cursor->startOfWeek(Carbon::MONDAY),
            'month' => $cursor->startOfMonth(),
            default => $cursor,
        };
        $points = [];
        while ($cursor->lte($to) && count($points) < 400) {
            $key = $cursor->toDateString();
            $row = $rows->get($key);
            $points[] = ['date' => $key, 'total' => $row ? Money::toInt($row->total) : 0, 'orders' => $row ? (int) $row->orders : 0];
            $cursor = match ($granularity) {
                'week' => $cursor->addWeek(),
                'month' => $cursor->addMonth(),
                default => $cursor->addDay(),
            };
        }

        return ['granularity' => $granularity, 'points' => $points];
    }

    /** Pendapatan per kategori produk (nilai baris setelah diskon baris), urut terbesar. */
    public static function byCategory(Builder $orders): array
    {
        return DB::table('order_items as oi')
            ->leftJoin('products as p', 'p.id', '=', 'oi.product_id')
            ->leftJoin('categories as c', 'c.id', '=', 'p.category_id')
            ->whereIn('oi.order_id', (clone $orders)->select('orders.id'))
            ->select('c.id', 'c.name', DB::raw('SUM(oi.qty) AS qty'), DB::raw('COUNT(DISTINCT oi.order_id) AS orders'), DB::raw('COALESCE(SUM(oi.line_total - oi.discount_amount), 0) AS revenue'))
            ->groupBy('c.id', 'c.name')->orderByDesc('revenue')->get()
            ->map(fn ($row) => [
                'categoryId' => $row->id !== null ? (int) $row->id : null,
                'name' => $row->name ? json_decode($row->name, true) : ['id' => 'Tanpa kategori', 'en' => 'Uncategorised'],
                'qty' => (int) $row->qty,
                'orders' => (int) $row->orders,
                'revenue' => Money::toInt($row->revenue),
            ])->values()->all();
    }

    /** Pelanggan dengan pendapatan terbesar; nama & perusahaan dari snapshot order terakhirnya. */
    public static function topCustomers(Builder $orders, int $limit = 10): array
    {
        $rows = (clone $orders)
            ->select('user_id', DB::raw('COUNT(*) AS orders'), DB::raw('COALESCE(SUM(grand_total), 0) AS revenue'), DB::raw('MAX(paid_at) AS last_paid_at'), DB::raw('MAX(id) AS last_id'))
            ->groupBy('user_id')->orderByDesc('revenue')->limit($limit)->toBase()->get();
        $snapshots = Order::whereIn('id', $rows->pluck('last_id'))->get(['id', 'customer_snapshot'])->keyBy('id');

        return $rows->map(function ($row) use ($snapshots) {
            $snapshot = $snapshots->get($row->last_id)?->customer_snapshot ?? [];

            return [
                'userId' => $row->user_id !== null ? (int) $row->user_id : null,
                'name' => $snapshot['pic'] ?? $snapshot['name'] ?? '',
                'company' => $snapshot['company'] ?? $snapshot['name'] ?? '',
                'orders' => (int) $row->orders,
                'revenue' => Money::toInt($row->revenue),
                'lastPaidAt' => $row->last_paid_at ? Carbon::parse($row->last_paid_at)->setTimezone(config('app.timezone'))->toApiString() : null,
            ];
        })->values()->all();
    }

    /** Provinsi tujuan dari snapshot alamat; `__pickup` = ambil di pabrik (Loco), `__none` = tanpa alamat. */
    public static function byRegion(Builder $orders): array
    {
        $key = "COALESCE(NULLIF(shipping_address_snapshot->'region'->>'province', ''), CASE WHEN shipping_address_snapshot->>'type' = 'pickup' THEN '__pickup' ELSE '__none' END)";

        return (clone $orders)
            ->select(DB::raw("{$key} AS region"), DB::raw('COUNT(*) AS orders'), DB::raw('COALESCE(SUM(grand_total), 0) AS revenue'))
            ->groupBy(DB::raw($key))->orderByDesc('revenue')->toBase()->get()
            ->map(fn ($row) => ['region' => (string) $row->region, 'orders' => (int) $row->orders, 'revenue' => Money::toInt($row->revenue)])
            ->values()->all();
    }

    /** Metode pembayaran yang melunasi order (payment berstatus paid). */
    public static function byPaymentMethod(Builder $orders): array
    {
        return Payment::where('status', Payment::STATUS_PAID)
            ->whereIn('order_id', (clone $orders)->select('orders.id'))
            ->select('method', DB::raw('COUNT(DISTINCT order_id) AS orders'), DB::raw('COALESCE(SUM(amount), 0) AS amount'))
            ->groupBy('method')->orderByDesc('amount')->toBase()->get()
            ->map(fn ($row) => ['method' => (string) $row->method, 'orders' => (int) $row->orders, 'revenue' => Money::toInt($row->amount)])
            ->values()->all();
    }

    /** Cara serah terima (kode delivery term; null = order lama sebelum A-85, dihitung sebagai franco/zona). */
    public static function byDeliveryTerm(Builder $orders): array
    {
        return (clone $orders)
            ->select(DB::raw("COALESCE(delivery_term, 'franco') AS term"), DB::raw('COUNT(*) AS orders'), DB::raw('COALESCE(SUM(grand_total), 0) AS revenue'))
            ->groupBy(DB::raw("COALESCE(delivery_term, 'franco')"))->orderByDesc('revenue')->toBase()->get()
            ->map(fn ($row) => ['term' => (string) $row->term, 'orders' => (int) $row->orders, 'revenue' => Money::toInt($row->revenue)])
            ->values()->all();
    }

    /**
     * Kohort order yang DIBUAT dalam rentang (bukan paid_at): berapa yang dibayar, masih berjalan (belum bayar),
     * dibatalkan, atau kedaluwarsa, beserta nilainya. Dipakai untuk tingkat konversi dan potensi pendapatan hilang.
     */
    public static function funnel(Carbon $from, Carbon $to, string $currency = Money::CURRENCY_IDR): array
    {
        $paid = "'".implode("','", Order::PAID_STATUSES)."'";
        $row = Order::whereBetween('created_at', [$from, $to])->inCurrency($currency)
            ->select(
                DB::raw('COUNT(*) AS created'),
                DB::raw("COUNT(*) FILTER (WHERE status IN ({$paid})) AS paid"),
                DB::raw("COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled"),
                DB::raw("COUNT(*) FILTER (WHERE status = 'expired') AS expired"),
                DB::raw("COALESCE(SUM(grand_total) FILTER (WHERE status IN ({$paid})), 0) AS paid_value"),
                DB::raw("COALESCE(SUM(grand_total) FILTER (WHERE status IN ('cancelled', 'expired')), 0) AS lost_value"),
                DB::raw("COALESCE(SUM(grand_total) FILTER (WHERE status NOT IN ({$paid}, 'cancelled', 'expired')), 0) AS open_value")
            )->toBase()->first();
        $created = (int) $row->created;
        $paidCount = (int) $row->paid;
        $cancelled = (int) $row->cancelled;
        $expired = (int) $row->expired;

        return [
            'created' => $created,
            'paid' => $paidCount,
            'open' => max(0, $created - $paidCount - $cancelled - $expired),
            'cancelled' => $cancelled,
            'expired' => $expired,
            'paidValue' => Money::toInt($row->paid_value),
            'openValue' => Money::toInt($row->open_value),
            'lostValue' => Money::toInt($row->lost_value),
            'conversionPct' => $created > 0 ? round($paidCount / $created * 100, 1) : null,
        ];
    }

    /** Perubahan persen terhadap pembanding; null bila pembanding 0 (tidak bermakna). */
    public static function changePct(int|float $current, int|float $previous): ?float
    {
        return $previous > 0 ? round(($current - $previous) / $previous * 100, 1) : null;
    }
}
