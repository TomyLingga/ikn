'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { AdminPageHead, DataTable, AdminCard, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderStatus, paymentStatus } from '@/lib/commerce';
import { api, errorMessage } from '@/lib/api';
import { formatIDR, formatDate } from '@/lib/format';
import type { Order } from '@/lib/types';

type FilterMode = 'today' | 'this_week' | 'year_month' | 'custom';

interface ChartDataItem {
  label: string;
  key: string;
  total: number;
  orders: number;
}

interface SalesReport {
  summary: { orderCount: number; paidCount: number; totalPaid: number; itemsSold: number };
  chartMode: 'monthly' | 'daily';
  chartData: ChartDataItem[];
  topProducts: { product_slug: string; name: string; qty: number; value: number }[];
  orders: Order[];
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function AdminSalesReport() {
  const { lang } = useLang();
  const [report, setReport] = useState<SalesReport | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('year_month');

  // Filter states
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = Semua Bulan
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination state for Orders Table
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const monthNames = lang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_ID;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    params.set('filter', filterMode);

    if (filterMode === 'year_month') {
      params.set('year', String(selectedYear));
      params.set('month', String(selectedMonth));
    } else if (filterMode === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }

    const query = params.toString();
    api<SalesReport>(`/admin/reports/sales${query ? `?${query}` : ''}`)
      .then((result) => {
        if (!cancelled) {
          setReport(result);
          setCurrentPage(1); // Reset page on filter change
        }
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
  }, [filterMode, selectedYear, selectedMonth, from, to]);

  // Order table columns
  const orderColumns: Column<Order>[] = [
    { key: 'number', label: lang === 'en' ? 'Order No.' : 'No. Order', render: (o) => <span className="mono">{o.number}</span> },
    { key: 'customer', label: 'Customer', render: (o) => o.customer.name },
    { key: 'date', label: lang === 'en' ? 'Date' : 'Tanggal', render: (o) => formatDate(o.date) },
    { key: 'total', label: 'Total', align: 'right', render: (o) => formatIDR(o.total) },
    {
      key: 'payment',
      label: lang === 'en' ? 'Payment' : 'Pembayaran',
      render: (o) => paymentStatus[o.payment]?.[lang] || paymentStatus[o.payment]?.id || o.payment,
    },
    {
      key: 'status',
      label: 'Status',
      render: (o) => orderStatus[o.status]?.[lang] || orderStatus[o.status]?.id || o.status,
    },
  ];

  // Top products table columns with Ranking Badge
  const maxProductQty = Math.max(1, ...(report?.topProducts.map((p) => p.qty) ?? [1]));
  const productColumns: Column<SalesReport['topProducts'][0]>[] = [
    {
      key: 'rank',
      label: '#',
      render: (_, idx) => (
        <span className={`rank-badge ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''}`}>
          {idx + 1}
        </span>
      ),
    },
    { key: 'name', label: lang === 'en' ? 'Product Name' : 'Nama Produk' },
    {
      key: 'qty',
      label: lang === 'en' ? 'Qty Sold' : 'Terjual',
      align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <div style={{ width: 80, height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.round((p.qty / maxProductQty) * 100)}%`,
                height: '100%',
                background: 'var(--green)',
              }}
            />
          </div>
          <strong>{p.qty}</strong>
        </div>
      ),
    },
    {
      key: 'value',
      label: lang === 'en' ? 'Sales Value' : 'Nilai Penjualan',
      align: 'right',
      render: (p) => <strong>{formatIDR(p.value)}</strong>,
    },
  ];

  // Pagination for orders table
  const allOrders = report?.orders ?? [];
  const totalOrders = allOrders.length;

  return (
    <div>
      <AdminPageHead
        title={lang === 'en' ? 'Sales Reports' : 'Laporan Penjualan'}
        desc={
          lang === 'en'
            ? 'Sales summary, trend charts, and paid order analytics.'
            : 'Rekapitulasi penjualan, grafik tren, dan analisa pesanan terbayar.'
        }
      />

      {/* Filter Mode Selector (Pill Switches) */}
      <div style={{ marginBottom: 20 }}>
        <span className="field-label" style={{ display: 'block', marginBottom: 8 }}>
          {lang === 'en' ? 'Select Filter Type' : 'Pilih Jenis Filter'}
        </span>
        <div className="filter-pill-group">
          <button
            type="button"
            className={`filter-pill ${filterMode === 'today' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('today')}
          >
            {lang === 'en' ? 'Today' : 'Hari Ini'}
          </button>
          <button
            type="button"
            className={`filter-pill ${filterMode === 'this_week' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('this_week')}
          >
            {lang === 'en' ? 'This Week' : 'Minggu Ini'}
          </button>
          <button
            type="button"
            className={`filter-pill ${filterMode === 'year_month' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('year_month')}
          >
            {lang === 'en' ? 'Year & Month' : 'Tahun & Bulan'}
          </button>
          <button
            type="button"
            className={`filter-pill ${filterMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('custom')}
          >
            {lang === 'en' ? 'Date Range' : 'Rentang Tanggal'}
          </button>
        </div>

        {/* Dynamic Filter Controls */}
        <div className="admin-toolbar" style={{ marginTop: 12 }}>
          {filterMode === 'year_month' && (
            <>
              {/* Dropdown Tahun */}
              <label className="admin-filter">
                <span>{lang === 'en' ? 'Year:' : 'Tahun:'}</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>

              {/* Dropdown Bulan (Tampil setelah Tahun tersedia) */}
              <label className="admin-filter">
                <span>{lang === 'en' ? 'Month:' : 'Bulan:'}</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  <option value={0}>
                    {lang === 'en' ? 'All Months (12 Months)' : 'Semua Bulan (12 Bulan)'}
                  </option>
                  {monthNames.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {idx + 1} - {name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {filterMode === 'custom' && (
            <>
              <label className="admin-filter">
                <span>{lang === 'en' ? 'From' : 'Dari'}</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  style={{ border: 0, outline: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit' }}
                />
              </label>
              <label className="admin-filter">
                <span>{lang === 'en' ? 'To' : 'Sampai'}</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  style={{ border: 0, outline: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit' }}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && (
        <p className="admin-note">
          {lang === 'en' ? 'Loading sales data...' : 'Memuat data penjualan...'}
        </p>
      )}

      {report && !loading && (
        <div>
          {/* Ringkasan Penjualan — 3 Kolom Text Center */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 18,
              marginBottom: 22,
            }}
          >
            <div className="stat-card" style={{ textAlign: 'center', alignItems: 'center' }}>
              <span className="stat-value">{report.summary.paidCount}</span>
              <span className="stat-label">
                {lang === 'en' ? 'Paid Orders' : 'Order Terbayar (Lunas)'}
              </span>
            </div>
            <div className="stat-card" style={{ textAlign: 'center', alignItems: 'center' }}>
              <span className="stat-value">{formatIDR(report.summary.totalPaid)}</span>
              <span className="stat-label">
                {lang === 'en' ? 'Total Revenue' : 'Total Penjualan'}
              </span>
            </div>
            <div className="stat-card" style={{ textAlign: 'center', alignItems: 'center' }}>
              <span className="stat-value">{report.summary.itemsSold}</span>
              <span className="stat-label">
                {lang === 'en' ? 'Products Sold (Units)' : 'Produk Terjual (Unit)'}
              </span>
            </div>
          </div>

          {/* Redesigned Diagram Batang (Bar Chart) */}
          <div style={{ marginBottom: 26 }}>
            <AdminCard
              title={
                filterMode === 'year_month'
                  ? selectedMonth > 0
                    ? `${lang === 'en' ? 'Daily Sales Chart' : 'Grafik Penjualan Harian'} (${monthNames[selectedMonth - 1]} ${selectedYear})`
                    : `${lang === 'en' ? '12-Month Sales Chart' : 'Grafik Penjualan 12 Bulan'} (${selectedYear})`
                  : filterMode === 'today'
                  ? lang === 'en' ? 'Today Sales Chart' : 'Grafik Penjualan Hari Ini'
                  : filterMode === 'this_week'
                  ? lang === 'en' ? 'Weekly Sales Chart (Week 1 - 4)' : 'Grafik Penjualan Per Minggu (Minggu 1 - 4)'
                  : lang === 'en' ? 'Selected Period Sales Chart' : 'Grafik Penjualan Periode Terpilih'
              }
            >
              {report.chartData.length === 0 ? (
                <p className="admin-empty">
                  {lang === 'en' ? 'No sales data for this period.' : 'Tidak ada data penjualan pada periode ini.'}
                </p>
              ) : (
                <div className="chart-container-wrap">
                  <div className="bars-redesigned">
                    {report.chartData.map((d) => {
                      const maxChartTotal = Math.max(1, ...(report.chartData.map((cd) => cd.total) ?? [1]));
                      const heightPct = Math.max(6, Math.round((d.total / maxChartTotal) * 100));
                      return (
                        <div key={d.key} className="bar-col-item">
                          <div className="bar-tooltip">
                            {formatIDR(d.total)} ({d.orders} order)
                          </div>
                          <div
                            className="bar-fill"
                            style={{
                              height: `${heightPct}%`,
                              background: d.total > 0 ? 'var(--green)' : 'var(--line-strong)',
                              borderRadius: '4px 4px 0 0',
                              width: '100%',
                              transition: 'height 0.3s var(--ease)',
                            }}
                          />
                          <span
                            className="bar-label"
                            style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: 8 }}
                          >
                            {d.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </AdminCard>
          </div>

          {/* Produk Terlaris (Pesanan Dibayar) */}
          <div style={{ marginBottom: 26 }}>
            <AdminCard
              title={
                lang === 'en' ? 'Top Products from Paid Orders' : 'Produk Terlaris dari Pesanan Terbayar'
              }
            >
              <DataTable
                columns={productColumns}
                rows={report.topProducts}
                rowKey="product_slug"
                empty={
                  lang === 'en'
                    ? 'No products sold in this period.'
                    : 'Belum ada produk terjual pada periode ini.'
                }
              />
            </AdminCard>
          </div>

          {/* Daftar Order Pada Periode (dengan Pagination) */}
          <AdminCard
            title={
              lang === 'en'
                ? `Order List for Period (${totalOrders} Orders)`
                : `Daftar Order Pada Periode (${totalOrders} Order)`
            }
          >
            <DataTable
              columns={orderColumns}
              rows={allOrders}
              rowKey="number"
              empty={
                lang === 'en'
                  ? 'No orders found for this period.'
                  : 'Belum ada order pada periode ini.'
              }
            />
          </AdminCard>
        </div>
      )}
    </div>
  );
}
