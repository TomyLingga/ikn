'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AdminSalesChart from '@/components/admin/AdminSalesChart';
import { AdminCard, AdminPageHead, DataTable, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderLabel, paymentLabel } from '@/lib/commerce';
import { api, API_URL, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { defaultDateRange, queryString, type SalesReport, type SalesReportProduct } from '@/lib/admin';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';
import type { OrderSummary } from '@/lib/types';

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
    { key: 'total', label: 'Total', align: 'right', render: (o) => formatIDR(o.grandTotal) },
    { key: 'method', label: t('Metode', 'Method'), render: (o) => <span className="mono">{o.paymentMethod || '—'}</span> },
    { key: 'payment', label: t('Pembayaran', 'Payment'), render: (o) => <StatusBadge label={paymentLabel(o.paymentStatus)[lang]} tone={paymentLabel(o.paymentStatus).tone} small /> },
    { key: 'status', label: 'Status', render: (o) => <StatusBadge label={orderLabel(o.status)[lang]} tone={orderLabel(o.status).tone} small /> },
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
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === 'month' && (
          <label className="admin-filter">
            <span>{t('Bulan', 'Month')}</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {months.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
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
      {loading && !report && <p className="admin-field-hint">{t('Memuat laporan...', 'Loading report...')}</p>}

      {report && (
        <div aria-busy={loading}>
          <div className="admin-stat-grid admin-stat-grid-4">
            <div className="admin-stat">
              <span>{t('Order dibayar', 'Paid orders')}</span>
              <strong>{report.summary.orders}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('Total penjualan', 'Total revenue')}</span>
              <strong>{formatIDR(report.summary.revenue)}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('Rata-rata per order', 'Average per order')}</span>
              <strong>{formatIDR(report.summary.avgOrder)}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('Unit terjual', 'Units sold')}</span>
              <strong>{report.summary.items}</strong>
            </div>
          </div>

          <div className="admin-breakdown">
            <span>
              Subtotal <b>{formatIDR(report.summary.subtotal)}</b>
            </span>
            <span>
              {t('Diskon', 'Discount')} <b>−{formatIDR(report.summary.discount)}</b>
            </span>
            <span>
              {t('Ongkir', 'Shipping')} <b>{formatIDR(report.summary.shipping)}</b>
            </span>
            <span>
              {t('Biaya', 'Fees')} <b>{formatIDR(report.summary.fees)}</b>
            </span>
            <span>
              {t('PPN', 'VAT')} <b>{formatIDR(report.summary.tax)}</b>
            </span>
          </div>

          <div style={{ marginBottom: 22 }}>
            <AdminSalesChart
              data={report.byMonth}
              year={mode === 'range' ? undefined : report.period.year}
              years={mode === 'range' ? undefined : YEAR_OPTIONS}
              onYearChange={mode === 'range' ? undefined : (y) => setYear(y)}
              loading={loading}
              eyebrow={t('Tren penjualan', 'Sales trend')}
              title={`${t('Penjualan per bulan', 'Sales per month')} · ${periodLabel}`}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <AdminCard
              title={t('Produk terlaris', 'Top products')}
              desc={t(
                'Awalnya diurutkan dari nilai penjualan tertinggi (setelah diskon). Klik judul kolom Order, Terjual, atau Nilai penjualan untuk mengubah urutan.',
                'Initially sorted by highest sales value (after discounts). Click the Orders, Qty sold, or Sales value heading to change the order.',
              )}
            >
              <DataTable columns={productColumns} rows={report.byProduct} rowKey="productId" defaultSort={{ key: 'revenue', dir: 'desc' }} empty={t('Belum ada produk terjual pada periode ini.', 'No products sold in this period.')} />
            </AdminCard>
          </div>

          <AdminCard
            title={`${t('Daftar order', 'Order list')} (${report.summary.orders})`}
            desc={report.orders.length < report.summary.orders ? t(`Menampilkan ${report.orders.length} order terbaru; unduh CSV untuk daftar lengkap.`, `Showing the latest ${report.orders.length} orders; download the CSV for the full list.`) : undefined}
            action={{ label: t('Unduh CSV', 'Download CSV'), icon: 'arrowDown', onClick: downloadCsv }}
          >
            <DataTable columns={orderColumns} rows={report.orders} rowKey="number" empty={t('Belum ada order dibayar pada periode ini.', 'No paid orders in this period.')} />
          </AdminCard>

          <p className="admin-field-hint" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="compass" size={15} />
            {t('CSV berisi satu baris per order (nomor, invoice, tanggal bayar, customer, subtotal, diskon, ongkir, biaya, PPN, kode unik, total, metode).', 'The CSV has one row per order (number, invoice, paid date, customer, subtotal, discount, shipping, fees, VAT, unique code, total, method).')}
          </p>
        </div>
      )}
    </div>
  );
}
