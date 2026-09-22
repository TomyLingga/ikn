'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Icon from '@/components/Icon';
import { formatIDR } from '@/lib/format';
import styles from './AdminSalesChart.module.css';

// Titik data penjualan bulanan dari API: ym 'YYYY-MM', total rupiah penuh.
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

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function parsePoint(point: SalesChartPoint | any, index: number): ChartPoint {
  const currentYear = new Date().getFullYear();
  let ymStr = '';

  if (point?.ym && typeof point.ym === 'string') {
    ymStr = point.ym;
  } else if (point?.year && point?.monthIndex) {
    ymStr = `${point.year}-${String(point.monthIndex).padStart(2, '0')}`;
  } else {
    ymStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
  }

  const year = ymStr.length >= 4 ? Number(ymStr.slice(0, 4)) || currentYear : currentYear;
  const monthIndex = ymStr.length >= 7 ? Number(ymStr.slice(5, 7)) || (index + 1) : (index + 1);

  return {
    ym: ymStr,
    year,
    monthIndex,
    month: point?.month || MONTHS_ID[monthIndex - 1] || ymStr,
    total: Number(point?.total) || 0,
    orders: Number(point?.orders) || 0,
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

export default function AdminSalesChart({ data }: { data?: SalesChartPoint[] }) {
  const safeData = Array.isArray(data) ? data : [];
  const points = useMemo(
    () => safeData.map(parsePoint).sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex),
    [safeData]
  );
  const years = useMemo(
    () => [...new Set(points.map((point) => point.year))].sort((a, b) => b - a),
    [points]
  );
  const [yearChoice, setYearChoice] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const year = yearChoice !== null && years.includes(yearChoice) ? yearChoice : (years[0] || new Date().getFullYear());
  const yearData = points.filter((point) => point.year === year);
  const selectedPoint = selectedMonth === 'all'
    ? null
    : yearData.find((point) => point.monthIndex === Number(selectedMonth)) ?? null;

  const yearlyTotal = yearData.reduce((sum, point) => sum + point.total, 0);
  const yearlyOrders = yearData.reduce((sum, point) => sum + point.orders, 0);
  const average = Math.round(yearlyTotal / Math.max(yearData.length, 1));
  const bestMonth = yearData.reduce<ChartPoint | null>(
    (best, point) => (!best || point.total > best.total ? point : best),
    null
  );
  const maxValue = Math.max(0, ...yearData.map((point) => point.total));
  const axisMax = niceCeil(maxValue);
  const axisValues = [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0];
  const selectedIndex = selectedPoint
    ? points.findIndex((point) => point.ym === selectedPoint.ym)
    : -1;
  const previousPoint = selectedIndex > 0 ? points[selectedIndex - 1] : null;
  const change = selectedPoint && previousPoint && previousPoint.total > 0
    ? ((selectedPoint.total - previousPoint.total) / previousPoint.total) * 100
    : null;

  function changeYear(nextYear: number) {
    setYearChoice(nextYear);
    setSelectedMonth('all');
  }

  return (
    <section className={styles.card} aria-labelledby="sales-chart-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Statistik penjualan</span>
          <h2 id="sales-chart-title">Penjualan bulanan</h2>
          <p>Pilih tahun atau bulan untuk membaca data lebih rinci.</p>
        </div>
        <div className={styles.filters}>
          <label>
            <span>Tahun</span>
            <select value={year ?? ''} onChange={(event) => changeYear(Number(event.target.value))}>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Bulan</span>
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              <option value="all">Semua bulan</option>
              {yearData.map((point) => <option key={point.monthIndex} value={point.monthIndex}>{point.month}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className={styles.summary}>
        <div>
          <span>{selectedPoint ? `${selectedPoint.month} ${year}` : `Total ${year ?? '—'}`}</span>
          <strong>{formatIDR(selectedPoint?.total ?? yearlyTotal)}</strong>
        </div>
        <div>
          <span>Jumlah pesanan</span>
          <strong>{selectedPoint?.orders ?? yearlyOrders}</strong>
        </div>
        <div>
          <span>{selectedPoint ? 'Dari bulan sebelumnya' : 'Rata-rata per bulan'}</span>
          <strong className={change !== null && change < 0 ? styles.negative : styles.positive}>
            {selectedPoint ? (change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : '—') : formatIDR(average)}
          </strong>
        </div>
        <div>
          <span>Bulan tertinggi</span>
          <strong>{bestMonth ? `${bestMonth.month} · ${formatIDR(bestMonth.total)}` : 'Belum ada data'}</strong>
        </div>
      </div>

      <div className={styles.chartViewport}>
        <div className={styles.plot}>
          <div className={styles.grid} aria-hidden="true">
            {axisValues.map((value) => (
              <span key={value} className={styles.gridLine}><em>{formatAxis(value)}</em></span>
            ))}
          </div>
          <div className={styles.bars} role="list" aria-label={`Penjualan bulanan tahun ${year ?? ''}`}>
            {yearData.length === 0 && <p className={styles.hint}>Belum ada data penjualan.</p>}
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
                  aria-label={`${point.month} ${point.year}: ${formatIDR(point.total)}, ${point.orders} pesanan`}
                  onClick={() => setSelectedMonth(String(point.monthIndex))}
                >
                  <span className={styles.tooltip}>
                    <strong>{point.month} {point.year}</strong>
                    <span>{formatIDR(point.total)}</span>
                    <span>{point.orders} pesanan</span>
                  </span>
                  <span className={styles.barTrack}><span className={styles.barFill} /></span>
                  <span className={styles.barLabel}>{point.month}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className={styles.hint}><Icon name="compass" size={17} /> Arahkan kursor, fokuskan dengan keyboard, atau ketuk batang untuk melihat nilainya.</p>
    </section>
  );
}
