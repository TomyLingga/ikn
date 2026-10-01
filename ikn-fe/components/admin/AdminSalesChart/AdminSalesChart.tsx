'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { formatIDR } from '@/lib/format';
import styles from './AdminSalesChart.module.css';
import Select from '@/components/Select';

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
const TICKS = 4;

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

// Puncak sumbu = TICKS × langkah "cantik" (1/2/5 × 10^n), supaya setiap garis bantu jatuh di angka bulat.
function axisTop(max: number, fallback: number, integer = false): number {
  if (max <= 0) return fallback;
  const raw = max / TICKS;
  const base = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / base;
  let step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * base;
  if (integer) step = Math.max(1, Math.ceil(step));
  return step * TICKS;
}

// Label sumbu ringkas: ribuan (rb) / jutaan (jt) / miliar (M).
function formatAxis(value: number): string {
  if (value >= 1_000_000_000) return `${Math.round((value / 1_000_000_000) * 10) / 10} M`;
  if (value >= 1_000_000) return `${Math.round((value / 1_000_000) * 10) / 10} jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(Math.round(value));
}

// Grafik penjualan bulanan: dua batang per bulan (pendapatan di sumbu kiri, jumlah order di sumbu kanan).
// Rincian bulan yang disorot tampil di pita tetap di atas area batang, jadi tidak pernah terpotong tepi kartu.
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
  const [hovered, setHovered] = useState<string | null>(null);

  const year =
    controlledYear ??
    (yearChoice !== null && years.includes(yearChoice) ? yearChoice : years[0] || new Date().getFullYear());
  // Selalu 12 bulan: laporan hanya mengirim bulan yang punya penjualan, bulan lain diisi nol agar sumbu tetap utuh.
  const yearData = useMemo(() => {
    const byMonth = new Map(points.filter((point) => point.year === year).map((point) => [point.monthIndex, point]));
    return months.map<ChartPoint>((month, index) => {
      const monthIndex = index + 1;
      return byMonth.get(monthIndex) ?? { ym: `${year}-${String(monthIndex).padStart(2, '0')}`, year, monthIndex, month, total: 0, orders: 0 };
    });
  }, [points, year, months]);
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

  const revenueTop = axisTop(Math.max(0, ...yearData.map((point) => point.total)), 1_000_000);
  const ordersTop = axisTop(Math.max(0, ...yearData.map((point) => point.orders)), TICKS, true);
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => TICKS - i);

  const selectedIndex = selectedPoint ? yearData.findIndex((point) => point.ym === selectedPoint.ym) : -1;
  const previousPoint = selectedIndex > 0 ? yearData[selectedIndex - 1] : null;
  const change =
    selectedPoint && previousPoint && previousPoint.total > 0
      ? ((selectedPoint.total - previousPoint.total) / previousPoint.total) * 100
      : null;

  // Bulan yang rinciannya ditampilkan: yang disorot kursor/fokus, kalau tidak ada maka bulan terpilih.
  const activeIndex = hovered ? yearData.findIndex((point) => point.ym === hovered) : selectedIndex;
  const activePoint = activeIndex >= 0 ? yearData[activeIndex] : null;

  function changeYear(nextYear: number) {
    setSelectedMonth('all');
    setHovered(null);
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
              'Pendapatan dan jumlah order yang sudah dibayar (berdasarkan tanggal bayar). Pilih tahun atau bulan untuk rincian.',
              'Revenue and number of paid orders (by payment date). Pick a year or month for details.',
            )}
          </p>
        </div>
        <div className={styles.filters}>
          <label>
            <span>{t('Tahun', 'Year')}</span>
            <Select value={year} disabled={loading} onChange={(event) => changeYear(Number(event.target.value))}>
              {(years.includes(year) ? years : [year, ...years]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>{t('Bulan', 'Month')}</span>
            <Select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              <option value="all">{t('Semua bulan', 'All months')}</option>
              {yearData.map((point) => (
                <option key={point.monthIndex} value={point.monthIndex}>
                  {point.month}
                </option>
              ))}
            </Select>
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
        <div className={styles.plot} onMouseLeave={() => setHovered(null)}>
          <div className={`${styles.legend} ${activePoint ? styles.legendDim : ''}`} aria-hidden="true">
            <span>
              <i className={styles.swatchRevenue} /> {t('Pendapatan (Rp, sumbu kiri)', 'Revenue (Rp, left axis)')}
            </span>
            <span>
              <i className={styles.swatchOrders} /> {t('Jumlah order (sumbu kanan)', 'Orders (right axis)')}
            </span>
          </div>
          {/* Pita rincian: posisinya mengikuti bulan yang disorot dan dijepit di dalam lebar grafik. */}
          <div
            className={`${styles.readout} ${activePoint ? styles.readoutOn : ''}`}
            style={{ '--pos': yearData.length ? (Math.max(activeIndex, 0) + 0.5) / yearData.length : 0.5 } as CSSProperties}
            role="status"
            aria-live="polite"
          >
            {activePoint && (
              <>
                <strong>
                  {activePoint.month} {activePoint.year}
                </strong>
                <span>
                  <i className={styles.swatchRevenue} /> {formatIDR(activePoint.total)}
                </span>
                <span>
                  <i className={styles.swatchOrders} /> {activePoint.orders} {t('order', activePoint.orders === 1 ? 'order' : 'orders')}
                </span>
              </>
            )}
          </div>

          <div className={styles.grid} aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} className={styles.gridLine}>
                <em className={styles.axisLeft}>{formatAxis((revenueTop / TICKS) * tick)}</em>
                <em className={styles.axisRight}>{Math.round((ordersTop / TICKS) * tick)}</em>
              </span>
            ))}
          </div>

          <div className={styles.bars} role="group" aria-label={`${t('Penjualan bulanan tahun', 'Monthly sales for')} ${year}`}>
            {yearData.map((point) => {
              const selected = selectedPoint?.monthIndex === point.monthIndex;
              const active = activePoint?.ym === point.ym;
              return (
                <button
                  key={point.ym}
                  type="button"
                  className={`${styles.col} ${selected ? styles.selected : ''} ${active ? styles.active : ''}`}
                  style={
                    {
                      '--h-revenue': `${Math.min(100, (point.total / revenueTop) * 100)}%`,
                      '--h-orders': `${Math.min(100, (point.orders / ordersTop) * 100)}%`,
                    } as CSSProperties
                  }
                  aria-pressed={selected}
                  aria-label={`${point.month} ${point.year}: ${formatIDR(point.total)}, ${point.orders} ${t('order', 'orders')}`}
                  onMouseEnter={() => setHovered(point.ym)}
                  onFocus={() => setHovered(point.ym)}
                  onBlur={() => setHovered(null)}
                  onClick={() => setSelectedMonth(selected ? 'all' : String(point.monthIndex))}
                >
                  <span className={styles.colBars}>
                    <span className={`${styles.barFill} ${styles.barRevenue} ${point.total > 0 ? '' : styles.barZero}`} />
                    <span className={`${styles.barFill} ${styles.barOrders} ${point.orders > 0 ? '' : styles.barZero}`} />
                  </span>
                  <span className={styles.colLabel}>{point.month}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className={styles.hint}>
        <Icon name="compass" size={17} />{' '}
        {t(
          'Arahkan kursor atau fokuskan bulan untuk melihat nilainya; klik untuk mengunci rincian bulan itu.',
          'Hover or focus a month to see its values; click to pin that month.',
        )}
      </p>
    </section>
  );
}
