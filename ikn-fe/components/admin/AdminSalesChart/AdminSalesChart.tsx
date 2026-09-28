'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { formatIDR } from '@/lib/format';
import styles from './AdminSalesChart.module.css';

// Titik data penjualan bulanan dari API (dashboard `salesChart[]`, laporan `byMonth[]`): total rupiah penuh.
export interface SalesChartPoint {
  ym?: string;
  month?: string;
  monthIndex?: number;
  year?: number;
  total?: number;
  orders?: number;
}

interface ChartPoint {
  ym: string;
  year: number;
  monthIndex: number;
  month: string;
  total: number;
  orders: number;
}

interface AdminSalesChartProps {
  data?: SalesChartPoint[];
  /** Tahun yang sedang ditampilkan (terkendali dari luar, mis. GET /admin/dashboard?year). */
  year?: number;
  /** Pilihan tahun pada dropdown; default dari data atau 5 tahun terakhir. */
  years?: number[];
  /** Bila diisi, pemilih tahun memanggil ini (server memuat ulang data) alih-alih memfilter lokal. */
  onYearChange?: (year: number) => void;
  loading?: boolean;
  title?: string;
  eyebrow?: string;
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parsePoint(point: SalesChartPoint, index: number, months: string[]): ChartPoint {
  const currentYear = new Date().getFullYear();
  let ymStr = '';

  if (point.ym && typeof point.ym === 'string') {
    ymStr = point.ym;
  } else if (point.year && point.monthIndex) {
    ymStr = `${point.year}-${String(point.monthIndex).padStart(2, '0')}`;
  } else {
    ymStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
  }

  const year = ymStr.length >= 4 ? Number(ymStr.slice(0, 4)) || currentYear : currentYear;
  const monthIndex = ymStr.length >= 7 ? Number(ymStr.slice(5, 7)) || index + 1 : index + 1;

  return {
    ym: ymStr,
    year,
    monthIndex,
    month: months[monthIndex - 1] || point.month || ymStr,
    total: Number(point.total) || 0,
    orders: Number(point.orders) || 0,
  };
}

// Bulatkan ke atas menuju angka "cantik" (1/2/5 × 10^n) untuk sumbu.
function niceCeil(value: number): number {
  if (value <= 0) return 1_000_000;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const fraction = value / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

// Label sumbu ringkas: jutaan (jt) / miliar (M).
function formatAxis(value: number): string {
  if (value >= 1_000_000_000) return `${Math.round((value / 1_000_000_000) * 10) / 10} M`;
  if (value >= 1_000_000) return `${Math.round((value / 1_000_000) * 10) / 10} jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(Math.round(value));
}

export default function AdminSalesChart({
  data,
  year: controlledYear,
  years: yearOptions,
  onYearChange,
  loading = false,
  title,
  eyebrow,
}: AdminSalesChartProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const months = lang === 'en' ? MONTHS_EN : MONTHS_ID;

  const points = useMemo(
    () =>
      (Array.isArray(data) ? data : [])
        .map((point, index) => parsePoint(point, index, months))
        .sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex),
    [data, months],
  );

  const years = useMemo(() => {
    if (yearOptions && yearOptions.length > 0) return [...yearOptions].sort((a, b) => b - a);
    const fromData = [...new Set(points.map((point) => point.year))];
    if (fromData.length > 0) return fromData.sort((a, b) => b - a);
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3, current - 4];
  }, [yearOptions, points]);

  const [yearChoice, setYearChoice] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('all');

  const year =
    controlledYear ??
    (yearChoice !== null && years.includes(yearChoice) ? yearChoice : years[0] || new Date().getFullYear());
  const yearData = points.filter((point) => point.year === year);
  const selectedPoint =
    selectedMonth === 'all' ? null : yearData.find((point) => point.monthIndex === Number(selectedMonth)) ?? null;

  const yearlyTotal = yearData.reduce((sum, point) => sum + point.total, 0);
  const yearlyOrders = yearData.reduce((sum, point) => sum + point.orders, 0);
  const monthsWithSales = yearData.filter((point) => point.total > 0).length;
  const average = Math.round(yearlyTotal / Math.max(monthsWithSales, 1));
  const bestMonth = yearData.reduce<ChartPoint | null>(
    (best, point) => (!best || point.total > best.total ? point : best),
    null,
  );
  const maxValue = Math.max(0, ...yearData.map((point) => point.total));
  const axisMax = niceCeil(maxValue);
  const axisValues = [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0];
  const selectedIndex = selectedPoint ? yearData.findIndex((point) => point.ym === selectedPoint.ym) : -1;
  const previousPoint = selectedIndex > 0 ? yearData[selectedIndex - 1] : null;
  const change =
    selectedPoint && previousPoint && previousPoint.total > 0
      ? ((selectedPoint.total - previousPoint.total) / previousPoint.total) * 100
      : null;

  function changeYear(nextYear: number) {
    setSelectedMonth('all');
    if (onYearChange) onYearChange(nextYear);
    else setYearChoice(nextYear);
  }

  return (
    <section className={styles.card} aria-labelledby="sales-chart-title" aria-busy={loading}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{eyebrow || t('Statistik penjualan', 'Sales statistics')}</span>
          <h2 id="sales-chart-title">{title || t('Penjualan bulanan', 'Monthly sales')}</h2>
          <p>
            {t(
              'Pendapatan dari order yang sudah dibayar (berdasarkan tanggal bayar). Pilih tahun atau bulan untuk rincian.',
              'Revenue from paid orders (by payment date). Pick a year or month for details.',
            )}
          </p>
        </div>
        <div className={styles.filters}>
          <label>
            <span>{t('Tahun', 'Year')}</span>
            <select value={year} disabled={loading} onChange={(event) => changeYear(Number(event.target.value))}>
              {(years.includes(year) ? years : [year, ...years]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('Bulan', 'Month')}</span>
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              <option value="all">{t('Semua bulan', 'All months')}</option>
              {yearData.map((point) => (
                <option key={point.monthIndex} value={point.monthIndex}>
                  {point.month}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={styles.summary}>
        <div>
          <span>{selectedPoint ? `${selectedPoint.month} ${year}` : `Total ${year}`}</span>
          <strong>{formatIDR(selectedPoint?.total ?? yearlyTotal)}</strong>
        </div>
        <div>
          <span>{t('Jumlah order', 'Orders')}</span>
          <strong>{selectedPoint?.orders ?? yearlyOrders}</strong>
        </div>
        <div>
          <span>{selectedPoint ? t('Dari bulan sebelumnya', 'vs previous month') : t('Rata-rata per bulan aktif', 'Average per active month')}</span>
          <strong className={change !== null && change < 0 ? styles.negative : styles.positive}>
            {selectedPoint ? (change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : '—') : formatIDR(average)}
          </strong>
        </div>
        <div>
          <span>{t('Bulan tertinggi', 'Best month')}</span>
          <strong>{bestMonth && bestMonth.total > 0 ? `${bestMonth.month} · ${formatIDR(bestMonth.total)}` : t('Belum ada data', 'No data yet')}</strong>
        </div>
      </div>

      <div className={styles.chartViewport}>
        <div className={styles.plot}>
          <div className={styles.grid} aria-hidden="true">
            {axisValues.map((value) => (
              <span key={value} className={styles.gridLine}>
                <em>{formatAxis(value)}</em>
              </span>
            ))}
          </div>
          <div className={styles.bars} role="list" aria-label={`${t('Penjualan bulanan tahun', 'Monthly sales for')} ${year}`}>
            {yearData.length === 0 && (
              <p className={styles.hint}>{loading ? t('Memuat data...', 'Loading data...') : t('Belum ada data penjualan.', 'No sales data yet.')}</p>
            )}
            {yearData.map((point) => {
              const height = Math.max(5, Math.round((point.total / axisMax) * 100));
              const active = selectedPoint?.monthIndex === point.monthIndex;
              return (
                <button
                  key={point.ym}
                  type="button"
                  role="listitem"
                  className={`${styles.bar} ${active ? styles.selected : ''}`}
                  style={{ '--bar-height': `${height}%` } as CSSProperties}
                  aria-label={`${point.month} ${point.year}: ${formatIDR(point.total)}, ${point.orders} ${t('order', 'orders')}`}
                  onClick={() => setSelectedMonth(active ? 'all' : String(point.monthIndex))}
                >
                  <span className={styles.tooltip}>
                    <strong>
                      {point.month} {point.year}
                    </strong>
                    <span>{formatIDR(point.total)}</span>
                    <span>
                      {point.orders} {t('order', 'orders')}
                    </span>
                  </span>
                  <span className={styles.barTrack}>
                    <span className={styles.barFill} />
                  </span>
                  <span className={styles.barLabel}>{point.month}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className={styles.hint}>
        <Icon name="compass" size={17} />{' '}
        {t(
          'Arahkan kursor, fokuskan dengan keyboard, atau ketuk batang untuk melihat nilainya.',
          'Hover, focus with the keyboard, or tap a bar to see its value.',
        )}
      </p>
    </section>
  );
}
