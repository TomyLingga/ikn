'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useLang } from '@/components/LanguageProvider';
import type { ExchangeRatePoint } from '@/lib/admin';
import type { Lang } from '@/lib/types';
import { formatIDR } from '@/lib/format';

// Grafik garis kurs harian JISDOR sebagai SVG inline tanpa library. Lebar SVG = lebar piksel nyata kartu
// (ResizeObserver) sehingga teks tidak ikut diskalakan. Sumbu x = skala waktu dari tanggal series, jadi akhir
// pekan/libur tampak sebagai celah kecil, tidak diinterpolasi sebagai titik. Sumbu y tidak dari nol agar selisih
// puluhan rupiah tetap terbaca; label sumbu y duduk di dalam area plot (tanpa talang kiri).
// Interaksi: pointer/sentuh menempel ke titik terdekat (crosshair + titik fokus + tooltip), keyboard
// (panah, PageUp/PageDown = 5 titik, Home/End, Esc). Warna lewat kelas .xr-* di admin.css (token tema, dark mode).

export type ChartGranularity = 'day' | 'month';

interface ExchangeRateChartProps {
  data: ExchangeRatePoint[];
  average?: number | null;
  /** 'day' = label tanggal (rentang 1 bulan), 'month' = label bulan (rentang lebih panjang). */
  granularity?: ChartGranularity;
}

/** Selisih kurs terhadap titik sebelumnya: rupiah + persen (null bila tidak ada pembanding). */
export interface RateChange {
  delta: number;
  pct: number;
}

export function rateChange(prev: number | null | undefined, cur: number | null | undefined): RateChange | null {
  if (prev == null || cur == null || !prev) return null;
  return { delta: cur - prev, pct: ((cur - prev) / prev) * 100 };
}

export function formatPct(pct: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(pct)) + '%';
}

/** Teks perubahan untuk pembaca layar / tooltip: "naik Rp 25 (0,14%)". */
export function changeText(change: RateChange | null, lang: Lang): string {
  if (!change) return '';
  if (change.delta === 0) return lang === 'en' ? 'unchanged' : 'tidak berubah';
  const dir = change.delta > 0 ? (lang === 'en' ? 'up' : 'naik') : lang === 'en' ? 'down' : 'turun';
  return `${dir} ${formatIDR(Math.abs(change.delta))} (${formatPct(change.pct, lang)})`;
}

/** Lencana perubahan berwarna: ▲ naik (--ok), ▼ turun (--red), = tetap. Simbol + teks, bukan warna saja. */
export function RateDelta({ change, showPct = true, className = '' }: { change: RateChange | null; showPct?: boolean; className?: string }) {
  const { lang } = useLang();
  if (!change) return <span className={`xr-delta is-flat ${className}`.trim()}>—</span>;
  const tone = change.delta > 0 ? 'is-up' : change.delta < 0 ? 'is-down' : 'is-flat';
  const arrow = change.delta > 0 ? '▲' : change.delta < 0 ? '▼' : '=';
  return (
    <span className={`xr-delta ${tone} ${className}`.trim()}>
      <span aria-hidden="true">{arrow}</span> {formatIDR(Math.abs(change.delta))}
      {showPct && <span className="xr-delta-pct"> ({formatPct(change.pct, lang)})</span>}
      <span className="sr-only">{` ${changeText(change, lang)}`}</span>
    </span>
  );
}

const PAD = { top: 34, right: 8, bottom: 30, left: 8 };
const TIP_W = 210;
const TIP_W_COMPACT = 176;

function parseDay(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}

// Langkah "bulat" (1 / 2 / 2,5 / 5 × 10^n) agar label sumbu y rapi.
function niceStep(range: number, intervals: number): number {
  const raw = Math.max(range, 1) / intervals;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * mag >= raw) return m * mag;
  }
  return 10 * mag;
}

// Kurva monoton kubik (Fritsch-Carlson, setara d3.curveMonotoneX): halus tanpa melampaui titik data,
// jadi puncak/lembah pada garis selalu nilai kurs yang benar.
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return '';
  const f = (v: number) => v.toFixed(1);
  const p0 = pts[0]!;
  if (n === 1) return `M${f(p0.x)},${f(p0.y)}`;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    slopes.push((b.y - a.y) / (b.x - a.x || 1));
  }
  const tangents: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const s0 = slopes[i - 1]!;
    const s1 = slopes[i]!;
    const h0 = pts[i]!.x - pts[i - 1]!.x || 1;
    const h1 = pts[i + 1]!.x - pts[i]!.x || 1;
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    tangents[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  tangents[0] = (3 * slopes[0]! - tangents[1]!) / 2;
  tangents[n - 1] = (3 * slopes[n - 2]! - tangents[n - 2]!) / 2;
  if (n === 2) {
    tangents[0] = slopes[0]!;
    tangents[1] = slopes[0]!;
  }
  let d = `M${f(p0.x)},${f(p0.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const h = (b.x - a.x) / 3;
    d += `C${f(a.x + h)},${f(a.y + tangents[i]! * h)},${f(b.x - h)},${f(b.y - tangents[i + 1]! * h)},${f(b.x)},${f(b.y)}`;
  }
  return d;
}

export default function ExchangeRateChart({ data, average = null, granularity = 'day' }: ExchangeRateChartProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const uid = useId().replace(/:/g, '');
  const gradId = `xr-grad-${uid}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipH, setTipH] = useState(110);

  // Tinggi tooltip nyata (isi bisa terlipat) untuk menjaganya tetap di dalam area grafik. Komponen ini hanya
  // dirender di klien (data dimuat di browser), jadi useLayoutEffect aman.
  useLayoutEffect(() => {
    const h = tipRef.current?.offsetHeight;
    if (h && h !== tipH) setTipH(h);
  }, [active, width, lang, tipH]);

  const points = useMemo(() => data.filter((p) => Number.isFinite(p.rate)), [data]);
  const hasPoints = points.length > 0;

  // Lebar piksel nyata area plot; dipasang ulang saat plot muncul (rentang kosong lalu berisi).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasPoints]);

  const signature = points.length ? `${points[0]!.date}-${points[points.length - 1]!.date}-${points.length}` : 'empty';

  // Data baru (ganti rentang): titik fokus lama tidak berlaku lagi.
  useEffect(() => setActive(null), [signature]);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }), [locale]);
  const fmtMonth = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short' }), [locale]);
  const fmtFull = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }), [locale]);
  const fmtShort = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }), [locale]);

  const height = width > 0 && width < 560 ? 240 : 320;
  const compact = width > 0 && width < 560;

  const chart = useMemo(() => {
    if (points.length === 0 || width === 0) return null;
    const rates = points.map((p) => p.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const intervals = compact ? 4 : 5;
    const pad = Math.max((max - min) * 0.14, 15);
    const step = niceStep(max - min + pad * 2, intervals);
    const yMin = Math.floor((min - pad) / step) * step;
    const yMax = Math.ceil((max + pad) / step) * step;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(v);

    const times = points.map((p) => parseDay(p.date));
    const t0 = times[0]!;
    const t1 = times[times.length - 1]!;
    const span = t1 - t0 || 1;
    const plotW = width - PAD.left - PAD.right;
    const base = height - PAD.bottom;
    const plotH = base - PAD.top;
    const x = (ms: number) => (points.length === 1 ? PAD.left + plotW / 2 : PAD.left + ((ms - t0) / span) * plotW);
    const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin || 1)) * plotH;

    const coords = points.map((p, i) => ({ ...p, ms: times[i]!, cx: x(times[i]!), cy: y(p.rate) }));
    const line = monotonePath(coords.map((c) => ({ x: c.cx, y: c.cy })));
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    const area = coords.length > 1 ? `${line}L${last.cx.toFixed(1)},${base}L${first.cx.toFixed(1)},${base}Z` : '';
    const maxIdx = rates.indexOf(max);
    const minIdx = rates.lastIndexOf(min);

    // Label sumbu x: harian = titik data berjarak cukup (dari kanan agar tanggal terakhir berlabel);
    // bulanan = awal tiap bulan di dalam rentang, dengan tahun pada Januari dan label pertama.
    const xLabels: { x: number; text: string; grid: boolean }[] = [];
    if (granularity === 'day') {
      const gap = compact ? 58 : 72;
      let lastX = Infinity;
      for (let i = coords.length - 1; i >= 0; i--) {
        const c = coords[i]!;
        if (lastX - c.cx >= gap) {
          xLabels.unshift({ x: c.cx, text: fmtDay.format(c.ms), grid: false });
          lastX = c.cx;
        }
      }
    } else {
      const gap = compact ? 40 : 56;
      const d = new Date(t0);
      d.setDate(1);
      if (d.getTime() < t0) d.setMonth(d.getMonth() + 1);
      let lastX = -Infinity;
      while (d.getTime() <= t1) {
        const px = x(d.getTime());
        if (px - lastX >= gap) {
          const withYear = d.getMonth() === 0 || xLabels.length === 0;
          xLabels.push({ x: px, text: withYear ? `${fmtMonth.format(d)} ${d.getFullYear()}` : fmtMonth.format(d), grid: true });
          lastX = px;
        }
        d.setMonth(d.getMonth() + 1);
      }
    }

    return { ticks, coords, line, area, base, plotW, y, maxIdx, minIdx, min, max, xLabels, first, last };
  }, [points, width, height, compact, granularity, fmtDay, fmtMonth]);

  if (points.length === 0) {
    return (
      <div className="xr-empty">
        <svg viewBox="0 0 120 48" width="120" height="48" aria-hidden="true">
          <path d="M4 40 C 24 40, 30 18, 50 22 S 80 36, 96 14 L 116 8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
        </svg>
        <strong>{t('Belum ada data kurs pada rentang ini.', 'No rate data in this range.')}</strong>
        <span>{t('Tunggu pengambilan kurs otomatis berikutnya atau tambah kurs manual.', 'Wait for the next automatic rate download or add a manual rate.')}</span>
      </div>
    );
  }

  const hasManual = points.some((p) => p.source === 'manual');
  const sourceLabel = (s: ExchangeRatePoint['source']) => (s === 'manual' ? t('Manual', 'Manual') : 'JISDOR');

  const firstP = points[0]!;
  const lastP = points[points.length - 1]!;
  const maxP = points.reduce((a, b) => (b.rate > a.rate ? b : a), firstP);
  const minP = points.reduce((a, b) => (b.rate <= a.rate ? b : a), firstP);
  const summary = t(
    `Grafik kurs JISDOR USD/IDR, ${points.length} hari kerja dari ${fmtShort.format(parseDay(firstP.date))} sampai ${fmtShort.format(parseDay(lastP.date))}. Terakhir ${formatIDR(lastP.rate)}, tertinggi ${formatIDR(maxP.rate)} pada ${fmtShort.format(parseDay(maxP.date))}, terendah ${formatIDR(minP.rate)} pada ${fmtShort.format(parseDay(minP.date))}. Gunakan tombol panah untuk menjelajah titik.`,
    `JISDOR USD/IDR rate chart, ${points.length} working days from ${fmtShort.format(parseDay(firstP.date))} to ${fmtShort.format(parseDay(lastP.date))}. Latest ${formatIDR(lastP.rate)}, highest ${formatIDR(maxP.rate)} on ${fmtShort.format(parseDay(maxP.date))}, lowest ${formatIDR(minP.rate)} on ${fmtShort.format(parseDay(minP.date))}. Use the arrow keys to explore points.`,
  );

  const nearest = (clientX: number): number | null => {
    const svg = wrapRef.current;
    if (!svg || !chart) return null;
    const px = clientX - svg.getBoundingClientRect().left;
    const cs = chart.coords;
    let lo = 0;
    let hi = cs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cs[mid]!.cx < px) lo = mid;
      else hi = mid;
    }
    return Math.abs(cs[lo]!.cx - px) <= Math.abs(cs[hi]!.cx - px) ? lo : hi;
  };

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const idx = nearest(event.clientX);
    if (idx !== null && idx !== active) setActive(idx);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const n = points.length;
    const cur = active ?? n - 1;
    let next: number | null = cur;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = active === null ? n - 1 : Math.max(0, cur - 1);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = active === null ? n - 1 : Math.min(n - 1, cur + 1);
        break;
      case 'PageDown':
        next = Math.max(0, cur - 5);
        break;
      case 'PageUp':
        next = Math.min(n - 1, cur + 5);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      case 'Escape':
        next = null;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActive(next);
  };

  const focus = chart && active !== null ? chart.coords[active] : undefined;
  const focusPrev = chart && active !== null && active > 0 ? chart.coords[active - 1] : undefined;
  const focusChange = focus ? rateChange(focusPrev?.rate, focus.rate) : null;

  // Tooltip: di samping crosshair (kanan, pindah ke kiri bila mentok), tengah vertikal di titik fokus. Bila grafik
  // terlalu sempit sehingga tooltip menutup titik, tooltip pindah ke atas atau bawah titik. Selalu di dalam batas grafik.
  let tipStyle: CSSProperties | undefined;
  if (focus && chart) {
    const tipW = Math.min(compact ? TIP_W_COMPACT : TIP_W, width - 8);
    let left = focus.cx + 14;
    if (left + tipW > width - 4) left = focus.cx - 14 - tipW;
    left = Math.max(4, Math.min(left, width - tipW - 4));
    const coversPoint = left - 6 <= focus.cx && focus.cx <= left + tipW + 6;
    let top = focus.cy - tipH / 2;
    if (coversPoint) top = focus.cy >= tipH + 18 ? focus.cy - tipH - 14 : focus.cy + 14;
    top = Math.max(4, Math.min(top, height - tipH - 4));
    tipStyle = { left, top, width: tipW };
  }

  const markerLabel = (c: NonNullable<typeof chart>['coords'][number], kind: 'max' | 'min') => {
    if (!chart) return null;
    const text = `${kind === 'max' ? t('Tertinggi', 'Highest') : t('Terendah', 'Lowest')} ${formatIDR(c.rate)}`;
    const half = compact ? 62 : 74;
    const anchor = c.cx < half ? 'start' : c.cx > width - half ? 'end' : 'middle';
    const tx = anchor === 'start' ? Math.max(PAD.left, c.cx - 6) : anchor === 'end' ? Math.min(width - PAD.right, c.cx + 6) : c.cx;
    let ty = kind === 'max' ? c.cy - 12 : c.cy + 20;
    if (kind === 'max' && ty < 12) ty = c.cy + 20;
    if (kind === 'min' && ty > chart.base - 4) ty = c.cy - 12;
    return (
      <text className={`xr-marker-label xr-marker-${kind}`} x={tx} y={ty} textAnchor={anchor}>
        {text}
      </text>
    );
  };

  const avgY = chart && average != null && points.length > 1 ? chart.y(average) : null;

  return (
    <div className="xr-chart-wrap">
      <div
        ref={wrapRef}
        className={`xr-plot${active !== null ? ' is-active' : ''}`}
        style={{ height }}
        tabIndex={0}
        role="application"
        aria-roledescription={t('grafik', 'chart')}
        aria-label={summary}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setActive(null);
        }}
        onKeyDown={onKey}
        onFocus={(e) => {
          if (e.target === e.currentTarget && active === null && e.currentTarget.matches(':focus-visible')) setActive(points.length - 1);
        }}
        onBlur={() => setActive(null)}
      >
        {chart && (
          <svg className="xr-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.26" />
                <stop offset="70%" stopColor="var(--primary)" stopOpacity="0.06" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {chart.xLabels.map((l) =>
              l.grid ? <line key={`g-${l.x}`} className="xr-vgrid" x1={l.x} x2={l.x} y1={PAD.top - 10} y2={chart.base} /> : null,
            )}
            {chart.ticks.map((v, i) => (
              <line key={`t-${v}`} className={`xr-grid${i === 0 ? ' xr-grid-base' : ''}`} x1={0} x2={width} y1={chart.y(v)} y2={chart.y(v)} />
            ))}

            {chart.area && <path key={`a-${signature}`} className="xr-area" d={chart.area} fill={`url(#${gradId})`} />}
            {avgY !== null && average != null && (
              <g className="xr-avg">
                <line x1={0} x2={width} y1={avgY} y2={avgY} />
                <text x={width - PAD.right} y={avgY - 6} textAnchor="end">
                  {`${t('Rata-rata', 'Average')} ${formatIDR(average)}`}
                </text>
              </g>
            )}
            <path key={`l-${signature}`} className="xr-line" d={chart.line} pathLength={1} />

            {/* Label sumbu y di dalam plot, di atas garis bantu (tanpa talang kiri); halo warna kartu agar terbaca. */}
            {chart.ticks.slice(1).map((v) => (
              <text key={`yl-${v}`} className="xr-ylabel" x={2} y={chart.y(v) - 5}>
                {formatIDR(v)}
              </text>
            ))}
            {chart.xLabels.map((l) => {
              const anchor = l.x < 24 ? 'start' : l.x > width - 24 ? 'end' : 'middle';
              return (
                <text key={`xl-${l.x}`} className="xr-xlabel" x={l.x} y={height - 9} textAnchor={anchor}>
                  {l.text}
                </text>
              );
            })}

            <g key={`m-${signature}`} className="xr-markers">
              {chart.coords.map((c) =>
                c.source === 'manual' ? (
                  <path key={`mn-${c.date}`} className="xr-manual" d={`M${c.cx},${c.cy - 5.5}L${c.cx + 5.5},${c.cy}L${c.cx},${c.cy + 5.5}L${c.cx - 5.5},${c.cy}Z`} />
                ) : null,
              )}
              {points.length > 1 && (
                <>
                  <circle className="xr-extreme" cx={chart.coords[chart.maxIdx]!.cx} cy={chart.coords[chart.maxIdx]!.cy} r={4} />
                  <circle className="xr-extreme" cx={chart.coords[chart.minIdx]!.cx} cy={chart.coords[chart.minIdx]!.cy} r={4} />
                  {markerLabel(chart.coords[chart.maxIdx]!, 'max')}
                  {chart.max !== chart.min && markerLabel(chart.coords[chart.minIdx]!, 'min')}
                </>
              )}
              <circle className="xr-last" cx={chart.last.cx} cy={chart.last.cy} r={4.5} />
            </g>

            {focus && (
              <g className="xr-focus">
                <line className="xr-cross" x1={focus.cx} x2={focus.cx} y1={PAD.top - 14} y2={chart.base} />
                <circle cx={focus.cx} cy={focus.cy} r={6} className={focus.source === 'manual' ? 'is-manual' : ''} />
              </g>
            )}
          </svg>
        )}

        {focus && tipStyle && (
          <div ref={tipRef} className="xr-tip" style={tipStyle} aria-hidden="true">
            <span className="xr-tip-date">{fmtFull.format(focus.ms)}</span>
            <strong className="xr-tip-rate">{formatIDR(focus.rate)}</strong>
            {focusChange ? (
              <span className="xr-tip-change">
                <RateDelta change={focusChange} />
                <small>{t('vs hari kerja sebelumnya', 'vs previous working day')}</small>
              </span>
            ) : (
              <span className="xr-tip-change">
                <small>{t('Titik pertama pada rentang ini', 'First point in this range')}</small>
              </span>
            )}
            <span className={`xr-tip-source${focus.source === 'manual' ? ' is-manual' : ''}`}>
              <i aria-hidden="true" />
              {t('Sumber', 'Source')}: {sourceLabel(focus.source)}
            </span>
          </div>
        )}

        <span className="sr-only" aria-live="polite">
          {focus ? `${fmtFull.format(focus.ms)}: ${formatIDR(focus.rate)}${focusChange ? `, ${changeText(focusChange, lang)}` : ''}, ${sourceLabel(focus.source)}` : ''}
        </span>
      </div>

      <div className="xr-legend">
        <span className="xr-key">
          <i className="xr-key-line" aria-hidden="true" />
          {t('Kurs JISDOR (Rp per USD)', 'JISDOR rate (Rp per USD)')}
        </span>
        {average != null && points.length > 1 && (
          <span className="xr-key">
            <i className="xr-key-avg" aria-hidden="true" />
            {t('Rata-rata rentang', 'Range average')}
          </span>
        )}
        {hasManual && (
          <span className="xr-key">
            <i className="xr-key-manual" aria-hidden="true" />
            {t('Kurs manual', 'Manual rate')}
          </span>
        )}
        <span className="xr-legend-hint">{t('Arahkan, sentuh, atau pakai tombol panah untuk melihat detail', 'Hover, tap, or use the arrow keys for details')}</span>
      </div>
    </div>
  );
}
