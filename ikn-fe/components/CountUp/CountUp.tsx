'use client';

import { useEffect, useRef, useState } from 'react';

// Angka yang "berjalan naik" dari 0 ke nilai akhir saat pertama terlihat di layar (easing ease-out), lalu
// beranimasi singkat ke nilai baru bila prop berubah (mis. ganti periode dashboard). Render awal = nilai akhir
// (aman untuk SSR/hidrasi); prefers-reduced-motion = tanpa animasi.
//   <CountUp value={1250000} format={formatIDR} />       angka + pemformat
//   <CountUp text="02" /> / <CountUp text="1.250,5 km" /> teks CMS: bagian angka dianimasikan, nol di depan,
//                                                        pemisah ribuan (.), desimal (,), awalan/akhiran dipertahankan.
//   Teks tanpa angka (mis. "III") ditampilkan apa adanya.

const EASE = (t: number) => 1 - Math.pow(1 - t, 3);

export interface ParsedNumber {
  prefix: string;
  num: number;
  suffix: string;
  decimals: number;
  pad: number;
  grouped: boolean;
}

export function parseNumericText(text: string): ParsedNumber | null {
  const m = /^([^\d]*?)(\d[\d.,]*)(.*)$/s.exec(text);
  if (!m) return null;
  const raw = m[2] ?? '';
  const dec = /,(\d{1,2})$/.exec(raw);
  const fracDigits = dec?.[1] ?? '';
  const decimals = fracDigits.length;
  const intPart = dec ? raw.slice(0, raw.length - dec[0].length) : raw;
  const grouped = intPart.includes('.');
  // Titik hanya pemisah ribuan ("1.250"); "12.5" atau "08.00" tampil apa adanya tanpa animasi.
  if (grouped && !/^\d{1,3}(\.\d{3})+$/.test(intPart)) return null;
  const digits = intPart.replace(/\./g, '');
  if (!/^\d+$/.test(digits)) return null;
  const num = Number(digits + (fracDigits ? '.' + fracDigits : ''));
  return { prefix: m[1] ?? '', num, suffix: m[3] ?? '', decimals, pad: /^0\d/.test(digits) ? digits.length : 0, grouped };
}

export function formatParsed(p: ParsedNumber, n: number): string {
  const fixed = n.toFixed(p.decimals);
  const dot = fixed.indexOf('.');
  const intRaw = dot === -1 ? fixed : fixed.slice(0, dot);
  const frac = dot === -1 ? '' : fixed.slice(dot + 1);
  let int = p.pad ? intRaw.padStart(p.pad, '0') : intRaw;
  if (p.grouped) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return p.prefix + int + (frac ? ',' + frac : '') + p.suffix;
}

interface CountUpProps {
  value?: number;
  text?: string;
  format?: (n: number) => string;
  /** Durasi animasi pertama (ms). Perubahan nilai berikutnya memakai setengahnya. */
  duration?: number;
  /** Jeda sebelum mulai (ms), mis. mengikuti stagger kartu. */
  delay?: number;
  className?: string;
}

export default function CountUp({ value, text, format, duration = 1400, delay = 0, className }: CountUpProps) {
  const parsed = text != null ? parseNumericText(text) : null;
  const target = value ?? parsed?.num ?? 0;
  const animatable = text != null ? parsed !== null : Number.isFinite(target);
  const fmtRef = useRef<(n: number) => string>(() => '');
  fmtRef.current = (n: number) => {
    if (text != null) return parsed ? formatParsed(parsed, n) : text;
    if (format) return format(n);
    return Math.round(n).toLocaleString('id-ID');
  };

  const [display, setDisplay] = useState(() => fmtRef.current(target));
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(target);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !animatable) {
      setDisplay(fmtRef.current(target));
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shown.current = target;
      setDisplay(fmtRef.current(target));
      return;
    }

    let raf = 0;
    let timer = 0;
    let observer: IntersectionObserver | null = null;
    const animate = (from: number, to: number, ms: number) => {
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        const v = p < 1 ? from + (to - from) * EASE(p) : to;
        shown.current = v;
        setDisplay(fmtRef.current(v));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    if (started.current) {
      // Nilai berubah setelah tampil: lanjutkan dari angka yang sedang terlihat.
      animate(shown.current, target, Math.max(400, duration / 2));
      return () => cancelAnimationFrame(raf);
    }

    // Belum terlihat: tampilkan nilai terbaru dulu (pembaca layar, cetak), animasi mulai saat masuk layar.
    shown.current = target;
    setDisplay(fmtRef.current(target));
    const start = () => {
      started.current = true;
      shown.current = 0;
      setDisplay(fmtRef.current(0));
      timer = window.setTimeout(() => animate(0, target, duration), delay);
    };
    if (typeof IntersectionObserver === 'undefined') {
      start();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer?.disconnect();
            start();
          }
        },
        { threshold: 0.2 },
      );
      observer.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [target, text, animatable, duration, delay]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {display}
    </span>
  );
}
