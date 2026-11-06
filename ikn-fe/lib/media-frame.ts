// Bingkai media per pemakaian (ASUMSI A-93): titik fokus (x, y dalam persen dari kiri/atas), zoom 1-3, dan rentang
// putar video (start/end detik). Berkas tidak diubah: gambar/video berkelas object-fit: cover memakai object-position
// + scale dari titik fokus, sehingga bagian penting tetap terlihat di frame rasio apa pun (desktop atau HP).
import type { CSSProperties } from 'react';
import type { MediaFrame } from '@/lib/cms';

export const DEFAULT_FRAME: MediaFrame = { x: 50, y: 50, zoom: 1, start: null, end: null };
export const FRAME_ZOOM_MAX = 3;

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const seconds = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/** Bingkai dari nilai API/form apa pun; null = bawaan (tengah, tanpa zoom, tanpa rentang). */
export function toFrame(value: unknown): MediaFrame | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const frame: MediaFrame = {
    x: num(v.x, 0, 100, 50),
    y: num(v.y, 0, 100, 50),
    zoom: num(v.zoom, 1, FRAME_ZOOM_MAX, 1),
    start: seconds(v.start),
    end: seconds(v.end),
  };
  if (frame.start !== null && frame.end !== null && frame.end <= frame.start) frame.end = null;
  return isDefaultFrame(frame) ? null : frame;
}

export function isDefaultFrame(frame: MediaFrame | null | undefined): boolean {
  return !frame || (frame.x === 50 && frame.y === 50 && frame.zoom === 1 && frame.start == null && frame.end == null);
}

/** Gaya untuk <img>/<video>/next/image berkelas object-fit: cover. Kosong bila bingkai bawaan. */
export function frameStyle(frame: MediaFrame | null | undefined): CSSProperties {
  if (!frame || isDefaultFrame(frame)) return {};
  const origin = `${frame.x}% ${frame.y}%`;
  return frame.zoom > 1 ? { objectPosition: origin, transform: `scale(${frame.zoom})`, transformOrigin: origin } : { objectPosition: origin };
}

/** Gaya untuk elemen ber-background-image (background-size: cover); zoom tidak diterapkan. */
export function frameBackground(frame: MediaFrame | null | undefined): CSSProperties {
  return frame && !isDefaultFrame(frame) ? { backgroundPosition: `${frame.x}% ${frame.y}%` } : {};
}

/** Bingkai yang menempel di ringkasan media (section, berita, galeri) atau di objek induknya. */
export function mediaFrame(media: { frame?: MediaFrame | null } | null | undefined): MediaFrame | null {
  return toFrame(media?.frame ?? null);
}

/** "0:05" dari detik. */
export function formatSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  const total = Math.max(0, value);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s % 1 ? s.toFixed(1) : s.toFixed(0)}`;
}

/** Ringkasan bingkai untuk keterangan di form admin, mis. "Fokus 30% · 40% · zoom 1,4× · 0:03–0:09". */
export function frameSummary(frame: MediaFrame | null | undefined, lang: 'id' | 'en' = 'id'): string {
  if (!frame || isDefaultFrame(frame)) return '';
  const parts: string[] = [];
  if (frame.x !== 50 || frame.y !== 50) parts.push(`${lang === 'en' ? 'Focus' : 'Fokus'} ${Math.round(frame.x)}% · ${Math.round(frame.y)}%`);
  if (frame.zoom > 1) parts.push(`zoom ${frame.zoom.toFixed(2).replace(/\.?0+$/, '')}×`);
  if (frame.start != null || frame.end != null) parts.push(`${formatSeconds(frame.start ?? 0)}–${frame.end != null ? formatSeconds(frame.end) : lang === 'en' ? 'end' : 'akhir'}`);
  return parts.join(' · ');
}
