'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AdminSalesChart from '@/components/admin/AdminSalesChart';
import CountUp from '@/components/CountUp';
import { AdminCard, AdminPageHead, DataTable, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderLabel, orderVariant, paymentLabel } from '@/lib/commerce';
import { api, API_URL, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { currencyLabels, defaultDateRange, queryString, type SalesByCurrency, type SalesReport, type SalesReportProduct } from '@/lib/admin';
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
    { key: 'method', label: t('Metode', 'Method'), render: (o) => <span className="mono">{o.paymentMethod || '—'}</span> },
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
                <span>
                  {t(`${report.summary.orders} order dibayar`, `${report.summary.orders} paid orders`)}
                </span>
              </div>
            </div>
            <div className="admin-stat rp-stat" style={{ '--i': 1 } as CSSProperties}>
              <span className="rp-stat-label">{t('Order dibayar', 'Paid orders')}</span>
              <strong><CountUp value={report.summary.orders} delay={70} /></strong>
              <div className="rp-stat-sub">{t(`order ${idr}`, `${idr} orders`)}</div>
            </div>
            <div className="admin-stat rp-stat" style={{ '--i': 2 } as CSSProperties}>
              <span className="rp-stat-label">{t('Rata-rata per order', 'Average per order')}</span>
              <strong><CountUp value={report.summary.avgOrder} format={formatIDR} delay={140} /></strong>
              <div className="rp-stat-sub">{t('total penjualan ÷ order dibayar', 'revenue ÷ paid orders')}</div>
            </div>
            <div className="admin-stat rp-stat" style={{ '--i': 3 } as CSSProperties}>
              <span className="rp-stat-label">{t('Unit terjual', 'Units sold')}</span>
              <strong><CountUp value={report.summary.items} delay={210} /></strong>
              <div className="rp-stat-sub">{t(`dari order ${idr}`, `from ${idr} orders`)}</div>
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

          <div style={{ marginBottom: 22 }}>
            <AdminSalesChart
              data={report.byMonth}
              year={mode === 'range' ? undefined : report.period.year}
              years={mode === 'range' ? undefined : YEAR_OPTIONS}
              onYearChange={mode === 'range' ? undefined : (y) => setYear(y)}
              loading={loading}
              eyebrow={t('Tren penjualan', 'Sales trend')}
              title={`${t('Penjualan per bulan', 'Sales per month')} (${idr}) · ${periodLabel}`}
            />
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
