'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AdminSalesChart from '@/components/admin/AdminSalesChart';
import { BarList, CHART_COLORS, DonutChart, TrendChart, deltaText } from '@/components/admin/ReportCharts';
import CountUp from '@/components/CountUp';
import { AdminCard, AdminPageHead, DataTable, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderLabel, orderVariant, paymentLabel } from '@/lib/commerce';
import { api, API_URL, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { currencyLabels, defaultDateRange, deliveryTermReportLabels, paymentMethodTypeLabels, queryString, type SalesByCurrency, type SalesReport, type SalesReportProduct } from '@/lib/admin';
import { formatDate, formatDateTime, formatIDR, formatMoney } from '@/lib/format';
import type { OrderSummary } from '@/lib/types';
import Select from '@/components/Select';
import Spinner from '@/components/Spinner';

type FilterMode = 'year' | 'month' | 'range';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Laporan penjualan: GET /admin/reports/sales?year&month&from&to (order dibayar, agregasi paid_at); ?format=csv untuk unduhan.
// v3 (2026-11-04): delta vs periode sebelumnya, tren dalam rentang, konversi order, rincian kategori/metode/serah
// terima/wilayah, dan pelanggan teratas.
export default function AdminSalesReport() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const months = lang === 'en' ? MONTHS_EN : MONTHS_ID;

  const [mode, setMode] = useState<FilterMode>('year');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  // Mode rentang tanggal: bawaan awal bulan s.d. hari ini.
  const [from, setFrom] = useState(() => defaultDateRange().from);
  const [to, setTo] = useState(() => defaultDateRange().to);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = mode === 'range' ? { from, to } : mode === 'month' ? { year, month } : { year };
  const query = queryString(params);

  useEffect(() => {
    if (mode === 'range' && !from && !to) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api<SalesReport>(`/admin/reports/sales${query}`)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, from, to, query]);

  function downloadCsv() {
    const separator = query ? '&' : '?';
    window.open(`${API_URL}/admin/reports/sales${query}${separator}format=csv`, '_blank', 'noopener');
  }

  const periodLabel = report
    ? mode === 'year'
      ? String(report.period.year)
      : mode === 'month'
        ? `${months[(report.period.month ?? month) - 1]} ${report.period.year}`
        : `${formatDate(report.period.from, lang)} – ${formatDate(report.period.to, lang)}`
    : '';

  const methodLabel = (code: string) => (paymentMethodTypeLabels as Record<string, { id: string; en: string }>)[code]?.[lang] ?? code;
  const termLabel = (code: string) => deliveryTermReportLabels[code]?.[lang] ?? code.toUpperCase();
  const regionLabel = (code: string) => (code === '__pickup' ? t('Ambil di pabrik (Loco)', 'Plant pickup (Loco)') : code === '__none' ? t('Tanpa alamat / ekspor', 'No address / export') : code);
  const shortIDR = (n: number) => {
    const abs = Math.abs(n);
    const fmt = (v: number) => v.toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID', { maximumFractionDigits: 1 });
    if (abs >= 1e9) return `${fmt(n / 1e9)} ${lang === 'en' ? 'bn' : 'M'}`;
    if (abs >= 1e6) return `${fmt(n / 1e6)} ${lang === 'en' ? 'm' : 'jt'}`;
    if (abs >= 1e3) return `${fmt(n / 1e3)} rb`;
    return String(n);
  };
  const cmp = report?.comparison;
  const cmpLabel = cmp ? `${formatDate(cmp.from, lang)} – ${formatDate(cmp.to, lang)}` : '';
  const Delta = ({ pct }: { pct: number | null | undefined }) => {
    const text = deltaText(pct);
    if (!text) return <span className="rp-delta is-flat">{t('baru', 'new')}</span>;
    return <span className={`rp-delta ${pct! > 0 ? 'is-up' : pct! < 0 ? 'is-down' : 'is-flat'}`}>{text}</span>;
  };
  const trend = report?.trend;
  const trendTotal = trend?.points.reduce((sum, p) => sum + p.total, 0) ?? 0;
  const trendActive = trend?.points.filter((p) => p.total > 0) ?? [];
  const trendBest = trendActive.reduce<(typeof trendActive)[number] | null>((best, p) => (!best || p.total > best.total ? p : best), null);
  const unitWord = trend?.granularity === 'week' ? t('minggu', 'week') : trend?.granularity === 'month' ? t('bulan', 'month') : t('hari', 'day');
  const funnel = report?.funnel;
  const custTotal = report?.topCustomers?.reduce((sum, c) => sum + c.revenue, 0) ?? 0;

  // Agregat lama (summary, byMonth, byProduct) hanya IDR; byCurrency dan orders memuat semua mata uang (Phase E6).
  const idr = report?.currency || 'IDR';
  const byCurrency = report?.byCurrency ?? [];
  const totalOrders = Math.max(byCurrency.reduce((sum, row) => sum + row.orders, 0), report?.orders.length ?? 0);

  const maxQty = Math.max(1, ...(report?.byProduct.map((p) => p.qty) ?? [1]));
  const productColumns: Column<SalesReportProduct>[] = [
    {
      key: 'rank',
      label: '#',
      render: (_p, idx) => <span className={`rank-badge ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''}`}>{idx + 1}</span>,
    },
    {
      key: 'name',
      label: t('Produk', 'Product'),
      sortValue: (p) => tr(p.name, lang),
      render: (p) => (
        <span>
          {p.productSlug ? (
            <Link href={`/catalog/${p.productSlug}`} className="link" target="_blank">
              {tr(p.name, lang)}
            </Link>
          ) : (
            tr(p.name, lang)
          )}
          {p.code && <small className="admin-cell-sub mono">{p.code}</small>}
        </span>
      ),
    },
    { key: 'orders', label: t('Order', 'Orders'), align: 'right', sortValue: (p) => p.orders, render: (p) => String(p.orders) },
    {
      key: 'qty',
      label: t('Terjual', 'Qty sold'),
      align: 'right',
      sortValue: (p) => p.qty,
      render: (p) => (
        <span className="admin-bar-cell">
          <span className="admin-bar-track">
            <span className="admin-bar-fill" style={{ width: `${Math.round((p.qty / maxQty) * 100)}%` }} />
          </span>
          <strong>{p.qty}</strong>
        </span>
      ),
    },
    { key: 'revenue', label: t('Nilai penjualan', 'Sales value'), align: 'right', sortValue: (p) => p.revenue, render: (p) => <strong>{formatIDR(p.revenue)}</strong> },
  ];

  const currencyColumns: Column<SalesByCurrency>[] = [
    {
      key: 'currency',
      label: t('Mata uang', 'Currency'),
      render: (row) => (
        <span>
          <strong className="mono">{row.currency}</strong>
          <small className="admin-cell-sub">{currencyLabels[row.currency]?.[lang] ?? row.currency}</small>
        </span>
      ),
    },
    { key: 'orders', label: t('Order dibayar', 'Paid orders'), align: 'right', render: (row) => String(row.paidOrders) },
    { key: 'revenue', label: t('Pendapatan', 'Revenue'), align: 'right', render: (row) => <strong>{formatMoney(row.revenue, row.currency)}</strong> },
    { key: 'average', label: t('Rata-rata per order', 'Average per order'), align: 'right', render: (row) => formatMoney(row.averageOrder, row.currency) },
  ];

  const orderColumns: Column<OrderSummary>[] = [
    {
      key: 'number',
      label: t('No. Order', 'Order No.'),
      render: (o) => (
        <span>
          <Link href={`/admin/orders/${encodeURIComponent(o.number)}`} className="mono link">
            {o.number}
          </Link>
          {o.invoiceNumber && <small className="admin-cell-sub mono">{o.invoiceNumber}</small>}
        </span>
      ),
    },
    { key: 'customer', label: 'Customer', render: (o) => o.customer.company || o.customer.name },
    { key: 'paidAt', label: t('Dibayar', 'Paid at'), render: (o) => formatDateTime(o.paidAt, lang) },
    { key: 'items', label: t('Item', 'Items'), align: 'right', render: (o) => String(o.itemsCount) },
    { key: 'currency', label: t('Mata uang', 'Currency'), render: (o) => <span className="mono">{o.currency}</span> },
    { key: 'total', label: 'Total', align: 'right', render: (o) => formatMoney(o.grandTotal, o.currency) },
    { key: 'method', label: t('Metode', 'Method'), render: (o) => (o.paymentMethod ? methodLabel(o.paymentMethod) : '—') },
    { key: 'payment', label: t('Pembayaran', 'Payment'), render: (o) => <StatusBadge label={paymentLabel(o.paymentStatus)[lang]} tone={paymentLabel(o.paymentStatus).tone} small /> },
    { key: 'status', label: 'Status', render: (o) => <StatusBadge label={orderLabel(o.status, orderVariant(o))[lang]} tone={orderLabel(o.status, orderVariant(o)).tone} small /> },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Laporan Penjualan', 'Sales Report')}
        desc={t('Rekap order yang sudah dibayar berdasarkan tanggal pembayaran; order dibatalkan/kedaluwarsa tidak dihitung.', 'Summary of paid orders by payment date; cancelled/expired orders are excluded.')}
        action={{ label: t('Unduh CSV', 'Download CSV'), icon: 'arrowDown', onClick: downloadCsv }}
      />

      <div className="filter-pill-group">
        <button type="button" className={`filter-pill ${mode === 'year' ? 'is-active' : ''}`} onClick={() => setMode('year')}>
          {t('Per tahun', 'By year')}
        </button>
        <button type="button" className={`filter-pill ${mode === 'month' ? 'is-active' : ''}`} onClick={() => setMode('month')}>
          {t('Per bulan', 'By month')}
        </button>
        <button type="button" className={`filter-pill ${mode === 'range' ? 'is-active' : ''}`} onClick={() => setMode('range')}>
          {t('Rentang tanggal', 'Date range')}
        </button>
      </div>

      <div className="admin-toolbar">
        {mode !== 'range' && (
          <label className="admin-filter">
            <span>{t('Tahun', 'Year')}</span>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </label>
        )}
        {mode === 'month' && (
          <label className="admin-filter">
            <span>{t('Bulan', 'Month')}</span>
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {months.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {mode === 'range' && (
          <>
            <label className="admin-filter">
              <span>{t('Dari', 'From')}</span>
              <input type="date" className="admin-filter-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="admin-filter">
              <span>{t('Sampai', 'To')}</span>
              <input type="date" className="admin-filter-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            {!from && !to && <span className="admin-field-hint">{t('Pilih tanggal awal dan/atau akhir.', 'Pick a start and/or end date.')}</span>}
          </>
        )}
        {report && (
          <span className="admin-result-count">
            {t('Periode', 'Period')}: {periodLabel}
          </span>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && !report && <Spinner block label={t('Memuat laporan...', 'Loading report...')} />}

      {report && (
        <div aria-busy={loading}>
          <div className="admin-stat-grid rp-stats">
            <div className="admin-stat rp-stat rp-stat-main" style={{ '--i': 0 } as CSSProperties}>
              <span className="rp-stat-label">{t('Total penjualan', 'Total revenue')} ({idr})</span>
              <strong><CountUp value={report.summary.revenue} format={formatIDR} /></strong>
              <div className="rp-stat-sub">
                <span>{t('Periode', 'Period')}: {periodLabel}</span>
                {cmp && (
                  <span className="rp-compare">
                    <Delta pct={cmp.changePct.revenue} /> {t('vs', 'vs')} {formatIDR(cmp.revenue)} ({cmpLabel})
                  </span>
                )}
              </div>
            </div>
            <div className="admin-stat rp-stat" style={{ '--i': 1 } as CSSProperties}>
              <span className="rp-stat-label">{t('Order dibayar', 'Paid orders')}</span>
              <strong><CountUp value={report.summary.orders} delay={70} /></strong>
              <div className="rp-stat-sub rp-compare">{cmp ? <><Delta pct={cmp.changePct.orders} /> {t('sebelumnya', 'previously')} {cmp.orders}</> : t(`order ${idr}`, `${idr} orders`)}</div>
            </div>
            <div className="admin-stat rp-stat" style={{ '--i': 2 } as CSSProperties}>
              <span className="rp-stat-label">{t('Rata-rata per order', 'Average per order')}</span>
              <strong><CountUp value={report.summary.avgOrder} format={formatIDR} delay={140} /></strong>
              <div className="rp-stat-sub rp-compare">{cmp ? <><Delta pct={cmp.changePct.avgOrder} /> {t('sebelumnya', 'previously')} {formatIDR(cmp.avgOrder)}</> : t('total penjualan ÷ order dibayar', 'revenue ÷ paid orders')}</div>
            </div>
            <div className="admin-stat rp-stat" style={{ '--i': 3 } as CSSProperties}>
              <span className="rp-stat-label">{t('Unit terjual', 'Units sold')}</span>
              <strong><CountUp value={report.summary.items} delay={210} /></strong>
              <div className="rp-stat-sub rp-compare">{cmp ? <><Delta pct={cmp.changePct.items} /> {t('sebelumnya', 'previously')} {cmp.items}</> : t(`dari order ${idr}`, `from ${idr} orders`)}</div>
            </div>
          </div>

          <div className="rp-breakdown" role="list" aria-label={t('Rincian penjualan', 'Revenue breakdown')}>
            {([
              ['Subtotal', 'Subtotal', report.summary.subtotal, ''],
              ['Diskon', 'Discount', report.summary.discount, 'is-minus'],
              ['Ongkir', 'Shipping', report.summary.shipping, ''],
              ['Biaya', 'Fees', report.summary.fees, ''],
              ['PPN', 'VAT', report.summary.tax, ''],
            ] as const).map(([idLabel, enLabel, value, tone], i) => (
              <div key={idLabel} role="listitem" className={`rp-break ${tone}`} style={{ '--i': i + 4 } as CSSProperties}>
                <span>{t(idLabel, enLabel)}</span>
                <b><CountUp value={value} format={(n) => (tone ? `−${formatIDR(n)}` : formatIDR(n))} delay={280 + i * 50} /></b>
              </div>
            ))}
          </div>

          {byCurrency.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <AdminCard
                title={t('Penjualan per mata uang', 'Sales by currency')}
                desc={t(
                  'Order dibayar pada periode ini dikelompokkan per mata uang; angka dalam mata uang baris itu, tanpa konversi kurs. Kartu dan grafik di atas hanya menghitung IDR.',
                  'Paid orders in this period grouped by currency; amounts are in that row\'s currency with no exchange-rate conversion. The cards and chart above count IDR only.',
                )}
              >
                <DataTable columns={currencyColumns} rows={byCurrency} rowKey="currency" pagination={false} />
              </AdminCard>
            </div>
          )}

          {mode === 'year' ? (
            <div style={{ marginBottom: 22 }}>
              <AdminSalesChart
                data={report.byMonth}
                year={report.period.year}
                years={YEAR_OPTIONS}
                onYearChange={(y) => setYear(y)}
                loading={loading}
                eyebrow={t('Tren penjualan', 'Sales trend')}
                title={`${t('Penjualan per bulan', 'Sales per month')} (${idr}) · ${periodLabel}`}
              />
            </div>
          ) : (
            trend && (
              <div style={{ marginBottom: 22 }}>
                <AdminCard
                  title={`${t('Tren pendapatan', 'Revenue trend')} (${idr}) · ${periodLabel}`}
                  desc={t(`Pendapatan per ${unitWord} dari order dibayar. Arahkan kursor atau gunakan tombol panah untuk melihat tiap titik.`, `Revenue per ${unitWord} from paid orders. Hover or use the arrow keys to read each point.`)}
                >
                  <div className="rp-trend-head">
                    <span className="rp-trend-fact">
                      <small>{t(`Rata-rata per ${unitWord}`, `Average per ${unitWord}`)}</small>
                      <b>{formatIDR(trend.points.length ? Math.round(trendTotal / trend.points.length) : 0)}</b>
                    </span>
                    <span className="rp-trend-fact">
                      <small>{t(`${unitWord[0]!.toUpperCase()}${unitWord.slice(1)} ada penjualan`, `${unitWord[0]!.toUpperCase()}${unitWord.slice(1)}s with sales`)}</small>
                      <b>
                        {trendActive.length} / {trend.points.length}
                      </b>
                    </span>
                    {trendBest && (
                      <span className="rp-trend-fact">
                        <small>{t('Tertinggi', 'Best')} · {formatDate(trendBest.date, lang)}</small>
                        <b>{formatIDR(trendBest.total)}</b>
                      </span>
                    )}
                  </div>
                  <TrendChart points={trend.points} granularity={trend.granularity} formatMoney={formatIDR} formatShortMoney={shortIDR} lang={lang} />
                </AdminCard>
              </div>
            )
          )}

          <div className="rp-grid-2">
            {funnel && (
              <AdminCard
                title={t('Konversi order', 'Order conversion')}
                desc={t('Order yang dibuat dalam periode ini (tanggal order) dan status akhirnya saat ini.', 'Orders created in this period (order date) and their current outcome.')}
              >
                <div className="rp-funnel">
                  <div className="rp-funnel-bar" aria-hidden="true">
                    {([['paid', '#2e9e8f'], ['open', '#42a5d5'], ['cancelled', '#d0605e'], ['expired', '#8a98ab']] as const).map(([k, color]) =>
                      funnel[k] > 0 ? <span key={k} style={{ flexGrow: funnel[k], background: color }} /> : null,
                    )}
                  </div>
                  <div className="rp-funnel-stats">
                    {([
                      ['paid', '#2e9e8f', t('Dibayar', 'Paid'), funnel.paidValue],
                      ['open', '#42a5d5', t('Berjalan', 'Open'), funnel.openValue],
                      ['cancelled', '#d0605e', t('Dibatalkan', 'Cancelled'), null],
                      ['expired', '#8a98ab', t('Kedaluwarsa', 'Expired'), null],
                    ] as const).map(([k, color, label, value]) => (
                      <div key={k} className="rp-funnel-stat">
                        <small>
                          <span className="ach-dot" style={{ background: color }} />
                          {label}
                        </small>
                        <b>{funnel[k]}</b>
                        <em>{value !== null ? formatIDR(value) : funnel.created > 0 ? `${((funnel[k] / funnel.created) * 100).toFixed(0)}%` : '—'}</em>
                      </div>
                    ))}
                  </div>
                  <p className="rp-funnel-note">
                    {t('Order dibuat', 'Orders created')}: <strong>{funnel.created}</strong> · {t('tingkat konversi', 'conversion rate')}:{' '}
                    <strong>{funnel.conversionPct !== null ? `${String(funnel.conversionPct).replace('.', ',')}%` : '—'}</strong> · {t('nilai batal/kedaluwarsa', 'cancelled/expired value')}:{' '}
                    <strong>{formatIDR(funnel.lostValue)}</strong>
                  </p>
                </div>
              </AdminCard>
            )}
            <AdminCard title={`${t('Penjualan per kategori', 'Sales by category')} (${idr})`} desc={t('Nilai baris produk setelah diskon baris, dikelompokkan menurut kategori katalog.', 'Product line value after line discounts, grouped by catalog category.')}>
              <DonutChart
                segments={(report.byCategory ?? []).map((row, i) => ({
                  key: String(row.categoryId ?? 'none'),
                  label: tr(row.name, lang),
                  value: row.revenue,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                  hint: `${row.qty.toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID')} unit · ${row.orders} order`,
                }))}
                format={formatIDR}
                centerValue={shortIDR((report.byCategory ?? []).reduce((sum, row) => sum + row.revenue, 0))}
                centerLabel={t('nilai produk', 'product value')}
                empty={t('Belum ada penjualan pada periode ini.', 'No sales in this period.')}
              />
            </AdminCard>
          </div>

          <div className="rp-grid-2">
            <AdminCard title={t('Metode pembayaran', 'Payment methods')} desc={t('Pembayaran lunas yang melunasi order pada periode ini.', 'Paid payments that settled orders in this period.')}>
              <DonutChart
                segments={(report.byPaymentMethod ?? []).map((row, i) => ({ key: row.method, label: methodLabel(row.method), value: row.revenue, color: CHART_COLORS[i % CHART_COLORS.length], hint: `${row.orders} order` }))}
                format={formatIDR}
                centerValue={String((report.byPaymentMethod ?? []).reduce((sum, row) => sum + row.orders, 0))}
                centerLabel={t('order lunas', 'paid orders')}
                empty={t('Belum ada pembayaran pada periode ini.', 'No payments in this period.')}
              />
            </AdminCard>
            <AdminCard title={t('Cara serah terima', 'Delivery terms')} desc={t('Pendapatan menurut cara serah terima order (Loco, Franco, FOB, CIF).', 'Revenue by order delivery term (Loco, Franco, FOB, CIF).')}>
              <BarList
                rows={(report.byDeliveryTerm ?? []).map((row, i) => ({ key: row.term, label: termLabel(row.term), value: row.revenue, sub: `${row.orders} order`, color: CHART_COLORS[i % CHART_COLORS.length] }))}
                format={formatIDR}
                empty={t('Belum ada order pada periode ini.', 'No orders in this period.')}
              />
            </AdminCard>
          </div>

          <div className="rp-grid-2">
            <AdminCard title={t('Wilayah tujuan', 'Destination regions')} desc={t('Provinsi alamat kirim; order ambil di pabrik dikelompokkan tersendiri.', 'Province of the delivery address; factory pickup orders are grouped separately.')}>
              <BarList
                rows={(report.byRegion ?? []).map((row) => ({ key: row.region, label: regionLabel(row.region), value: row.revenue, sub: `${row.orders} order`, color: CHART_COLORS[1] }))}
                format={formatIDR}
                empty={t('Belum ada order pada periode ini.', 'No orders in this period.')}
              />
            </AdminCard>
            <AdminCard
              title={t('Pelanggan teratas', 'Top customers')}
              desc={custTotal > 0 && report.summary.revenue > 0 ? t(`${report.topCustomers?.length ?? 0} pelanggan teratas menyumbang ${Math.round((custTotal / report.summary.revenue) * 100)}% pendapatan.`, `The top ${report.topCustomers?.length ?? 0} customers bring ${Math.round((custTotal / report.summary.revenue) * 100)}% of revenue.`) : undefined}
            >
              <BarList
                rows={(report.topCustomers ?? []).map((c, i) => ({
                  key: `${c.userId ?? 'x'}-${i}`,
                  label: `${i + 1}. ${c.company || c.name || '—'}`,
                  value: c.revenue,
                  sub: [c.company && c.name ? c.name : '', `${c.orders} order`, c.lastPaidAt ? `${t('bayar terakhir', 'last paid')} ${formatDate(c.lastPaidAt, lang)}` : ''].filter(Boolean).join(' · '),
                  color: CHART_COLORS[0],
                }))}
                format={formatIDR}
                limit={10}
                total={report.summary.revenue}
                empty={t('Belum ada pelanggan yang membayar pada periode ini.', 'No paying customers in this period.')}
              />
            </AdminCard>
          </div>

          <div style={{ marginBottom: 22 }}>
            <AdminCard
              title={`${t('Produk terlaris', 'Top products')} (${idr})`}
              desc={t(
                'Hanya order IDR. Awalnya diurutkan dari nilai penjualan tertinggi (setelah diskon). Klik judul kolom Order, Terjual, atau Nilai penjualan untuk mengubah urutan.',
                'IDR orders only. Initially sorted by highest sales value (after discounts). Click the Orders, Qty sold, or Sales value heading to change the order.',
              )}
            >
              <DataTable columns={productColumns} rows={report.byProduct} rowKey="productId" defaultSort={{ key: 'revenue', dir: 'desc' }} empty={t('Belum ada produk terjual pada periode ini.', 'No products sold in this period.')} />
            </AdminCard>
          </div>

          <AdminCard
            title={`${t('Daftar order', 'Order list')} (${totalOrders})`}
            desc={
              report.orders.length < totalOrders
                ? t(`Semua mata uang. Menampilkan ${report.orders.length} order terbaru; unduh CSV untuk daftar lengkap.`, `All currencies. Showing the latest ${report.orders.length} orders; download the CSV for the full list.`)
                : t('Semua mata uang; nilai ditulis dalam mata uang masing-masing order.', 'All currencies; amounts are shown in each order\'s own currency.')
            }
            action={{ label: t('Unduh CSV', 'Download CSV'), icon: 'arrowDown', onClick: downloadCsv }}
          >
            <DataTable columns={orderColumns} rows={report.orders} rowKey="number" empty={t('Belum ada order dibayar pada periode ini.', 'No paid orders in this period.')} />
          </AdminCard>

          <p className="admin-field-hint" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="compass" size={15} />
            {t(
              'CSV berisi satu baris per order semua mata uang (nomor, invoice, tanggal bayar, customer, mata uang, subtotal, diskon, ongkir, biaya, PPN, kode unik, total, metode); angka dalam satuan terkecil mata uang baris itu (rupiah untuk IDR, sen untuk USD), tanpa konversi kurs.',
              'The CSV has one row per order in every currency (number, invoice, paid date, customer, currency, subtotal, discount, shipping, fees, VAT, unique code, total, method); amounts are in the minor unit of that row\'s currency (rupiah for IDR, cents for USD), with no exchange-rate conversion.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}
