// Helper format bersama — mata uang, tanggal, nomor.
import type { Currency, Lang } from './types';

export function formatIDR(value: number | string | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

/** Jumlah digit desimal satuan terkecil per mata uang (ASUMSI A-86): IDR rupiah bulat, USD sen. */
export function currencyDecimals(currency: string | null | undefined): number {
  return (currency || 'IDR').toUpperCase() === 'USD' ? 2 : 0;
}

/**
 * Format uang dari satuan terkecil + mata uang: IDR = keluaran formatIDR ("Rp 12.500"), USD = "USD 12.50"
 * (pemisah ribuan en-US, selalu dua desimal). Pecahan dihitung dengan aritmetika bilangan bulat, bukan float.
 */
export function formatMoney(minor: number | string | null | undefined, currency: string | null | undefined, lang?: Lang): string {
  void lang;
  if (minor == null || minor === '' || Number.isNaN(Number(minor))) return '—';
  const code = (currency || 'IDR').toUpperCase();
  if (code === 'IDR') return formatIDR(minor);
  const value = Math.round(Number(minor));
  const decimals = currencyDecimals(code);
  const base = 10 ** decimals;
  const abs = Math.abs(value);
  const whole = Math.floor(abs / base);
  const fraction = abs - whole * base;
  const text = decimals > 0 ? `${whole.toLocaleString('en-US')}.${String(fraction).padStart(decimals, '0')}` : whole.toLocaleString('en-US');
  return `${value < 0 ? '−' : ''}${code} ${text}`;
}

/**
 * Nilai input desimal admin ("12.50" atau "12,50") → satuan terkecil (1250 untuk USD, 12500 untuk IDR).
 * Kosong/tidak valid → null, termasuk teks tanpa digit ("." atau "-") dan notasi eksponen ("1e5", lihat isExponentInput).
 * Diparse per bagian agar tidak lewat float.
 */
export function toMinorInput(value: string | number | null | undefined, currency: string | null | undefined): number | null {
  if (value == null) return null;
  const raw = String(value).trim().replace(/\s+/g, '');
  if (raw === '') return null;
  // Lookahead: minimal satu digit sebelum atau tepat sesudah pemisah desimal.
  const match = raw.match(/^(-)?(?=[.,]?\d)(\d*)(?:[.,](\d*))?$/);
  if (!match) return null;
  const decimals = currencyDecimals(currency);
  const whole = match[2] ? Number(match[2]) : 0;
  const fractionText = (match[3] || '').slice(0, decimals).padEnd(decimals, '0');
  const fraction = decimals > 0 ? Number(fractionText) : 0;
  if (!Number.isFinite(whole) || !Number.isFinite(fraction)) return null;
  const minor = whole * 10 ** decimals + fraction;
  return match[1] ? -minor : minor;
}

/** Input angka berisi notasi eksponen ("1e5", "2E-3"): `<input type="number">` menerimanya, toMinorInput tidak. */
export function isExponentInput(value: string | number | null | undefined): boolean {
  return value != null && /\d\s*e/i.test(String(value));
}

/** Satuan terkecil → teks input desimal admin ("1250" USD → "12.50"; IDR tetap "12500"). Null → "". */
export function fromMinorInput(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null || Number.isNaN(Number(minor))) return '';
  const decimals = currencyDecimals(currency);
  const value = Math.round(Number(minor));
  if (decimals === 0) return String(value);
  const base = 10 ** decimals;
  const abs = Math.abs(value);
  const whole = Math.floor(abs / base);
  const fraction = abs - whole * base;
  return `${value < 0 ? '-' : ''}${whole}.${String(fraction).padStart(decimals, '0')}`;
}

/** Nilai `step` untuk input angka per mata uang (0.01 untuk USD, 1 untuk IDR). */
export function currencyStep(currency: string | null | undefined): number {
  return currencyDecimals(currency) > 0 ? 1 / 10 ** currencyDecimals(currency) : 1;
}

export function isUsd(currency: Currency | string | null | undefined): boolean {
  return (currency || 'IDR').toUpperCase() === 'USD';
}

export function formatDate(
  input: string | number | Date | null | undefined,
  lang: Lang = 'id'
): string {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(
  input: string | number | Date | null | undefined,
  lang: Lang = 'id'
): string {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function pluralN(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : plural || singular}`;
}
