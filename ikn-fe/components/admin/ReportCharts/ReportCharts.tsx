'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { TrendPoint } from '@/lib/admin';

// Grafik kecil untuk dashboard & laporan penjualan (SVG murni, tanpa library): sparkline, donat, daftar batang,
// dan tren interaktif (crosshair + tooltip + keyboard). Warna kategori dari CHART_COLORS; semua menghormati tema.

export const CHART_COLORS = ['#1769aa', '#42a5d5', '#2e9e8f', '#e0a23b', '#7a6fd0', '#d0605e', '#8a98ab'];

// ------------------------------------------------------------------ Sparkline

export function Sparkline({ values, height = 36, label }: { values: number[]; height?: number; label?: string }) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const w = 120;
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;

  return (
    <svg className="ach-spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={`sp${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${height} L0 ${height} Z`} fill={`url(#sp${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill="currentColor" />
    </svg>
  );
}

// ------------------------------------------------------------------ Donut

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color?: string;
  hint?: string;
}

export function DonutChart({
  segments,
  format,
  centerLabel,
  centerValue,
  empty,
}: {
  segments: DonutSegment[];
  format: (n: number) => string;
  centerLabel: string;
  centerValue?: string;
  empty: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const rows = segments.filter((s) => s.value > 0);
  const total = rows.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return <p className="ach-empty">{empty}</p>;

  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const current = rows.find((s) => s.key === active);

  return (
    <div className="ach-donut">
      <div className="ach-donut-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} className="ach-donut-track" />
          {rows.map((s, i) => {
            const len = (s.value / total) * c;
            const seg = (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={r}
                stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeDasharray={`${Math.max(len - 1.2, 0.6)} ${c}`}
                strokeDashoffset={-offset}
                className={`ach-donut-seg${active && active !== s.key ? ' is-dim' : ''}`}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
              />
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div className="ach-donut-center">
          <strong>{current ? `${Math.round((current.value / total) * 100)}%` : centerValue ?? format(total)}</strong>
          <span>{current ? current.label : centerLabel}</span>
        </div>
      </div>
      <ul className="ach-legend">
        {rows.map((s, i) => (
          <li
            key={s.key}
            className={active === s.key ? 'is-active' : ''}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="ach-dot" style={{ background: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="ach-legend-label">
              {s.label}
              {s.hint && <small>{s.hint}</small>}
            </span>
            <span className="ach-legend-value">
              {format(s.value)}
              <small>{((s.value / total) * 100).toFixed(1).replace('.', ',')}%</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ Bar list

export interface BarRow {
  key: string;
  label: string;
  value: number;
  sub?: string;
  color?: string;
}

/** `total` = penyebut persen (bawaan jumlah semua baris), mis. total pendapatan periode untuk porsi pelanggan. */
export function BarList({ rows, format, empty, limit = 8, total: totalProp }: { rows: BarRow[]; format: (n: number) => string; empty: string; limit?: number; total?: number }) {
  const shown = rows.filter((r) => r.value > 0).slice(0, limit);
  if (shown.length === 0) return <p className="ach-empty">{empty}</p>;
  const max = Math.max(...shown.map((r) => r.value));
  const total = totalProp ?? rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <ul className="ach-bars">
      {shown.map((r, i) => (
        <li key={r.key} style={{ '--i': i } as React.CSSProperties}>
          <div className="ach-bars-top">
            <span className="ach-bars-label">{r.label}</span>
            <span className="ach-bars-value">{format(r.value)}</span>
          </div>
          <div className="ach-bars-track">
            <span style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color ?? CHART_COLORS[0] }} />
          </div>
          <div className="ach-bars-sub">
            <span>{r.sub}</span>
            <span>{total > 0 ? `${((r.value / total) * 100).toFixed(1).replace('.', ',')}%` : ''}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ Trend (interaktif)

export function TrendChart({
  points,
  granularity,
  formatMoney,
  formatShortMoney,
  lang,
  height = 260,
}: {
  points: TrendPoint[];
  granularity: 'day' | 'week' | 'month';
  formatMoney: (n: number) => string;
  formatShortMoney: (n: number) => string;
  lang: 'id' | 'en';
  height?: number;
}) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Lebar viewBox = lebar nyata kontainer agar teks sumbu tidak meregang dan tinggi tetap `height` px.
  const [W, setW] = useState(960);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => setW(Math.max(320, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const pad = { l: 56, r: 16, t: 16, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const { max, ticks } = useMemo(() => {
    const raw = Math.max(...points.map((p) => p.total), 1);
    const mag = 10 ** Math.floor(Math.log10(raw));
    const nice = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m * 4 >= raw) ?? raw;
    const top = nice * 4;
    return { max: top, ticks: [0, 1, 2, 3, 4].map((k) => k * nice) };
  }, [points]);

  if (points.length === 0) return null;
  const x = (i: number) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.total).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${pad.t + ih} L${x(0).toFixed(1)} ${pad.t + ih} Z`;
  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const fmtDate = (iso: string, long = false) => {
    const d = new Date(`${iso}T00:00:00`);
    if (granularity === 'month') return d.toLocaleDateString(locale, { month: long ? 'long' : 'short', year: 'numeric' });
    return d.toLocaleDateString(locale, long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });
  };
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(3, Math.floor(iw / 90))));
  const best = points.reduce((b, p, i) => (p.total > (points[b]?.total ?? 0) ? i : b), 0);

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
  }
  const hp = hover !== null ? points[hover] : null;
  const weekText = lang === 'en' ? 'Week of' : 'Pekan mulai';

  return (
    <div className="ach-trend" ref={wrap}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        style={{ height: H }}
        preserveAspectRatio="none"
        tabIndex={0}
        role="img"
        aria-label={lang === 'en' ? 'Revenue trend; use the arrow keys to read each point' : 'Tren pendapatan; gunakan tombol panah untuk membaca tiap titik'}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`tr${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--adm-primary)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--adm-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="ach-grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="ach-axis">
              {formatShortMoney(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle" className="ach-axis">
              {fmtDate(p.date)}
            </text>
          ) : null,
        )}
        <path d={area} fill={`url(#tr${id})`} />
        <path d={line} fill="none" stroke="var(--adm-primary)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {points[best]!.total > 0 && <circle cx={x(best)} cy={y(points[best]!.total)} r="4.5" className="ach-best" />}
        {hp && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="ach-cross" />
            <circle cx={x(hover)} cy={y(hp.total)} r="5" className="ach-hover-dot" />
          </g>
        )}
      </svg>
      {hp && hover !== null && (
        <div className="ach-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <span>{granularity === 'week' ? `${weekText} ${fmtDate(hp.date, true)}` : fmtDate(hp.date, true)}</span>
          <strong>{formatMoney(hp.total)}</strong>
          <small>
            {hp.orders} {lang === 'en' ? 'paid orders' : 'order dibayar'}
          </small>
        </div>
      )}
    </div>
  );
}

/** Persen perubahan untuk lencana delta: "+12,5%" / "−3%" / null bila tidak ada pembanding. */
export function deltaText(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const v = Math.abs(pct) >= 100 ? Math.round(pct).toString() : pct.toFixed(1).replace('.', ',').replace(/,0$/, '');
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${v.replace('-', '')}%`;
}
