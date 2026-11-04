// Header sesi pengunjung untuk fetch RSC ke API internal (hanya katalog): cookie Sanctum + Origin/Referer agar
// API mengenali customer yang login dan mengirim harga sesuai pasarnya (customer ekspor = USD, ASUMSI A-86).
// Hanya untuk server component; memanggil headers()/cookies() membuat rute dinamis (katalog sudah dinamis).
import { cache } from 'react';
import { headers } from 'next/headers';

export interface SessionForward {
  cookie: string;
  origin: string;
}

/** null bila request tanpa cookie (tamu): fetcher memakai jalur publik biasa dan hasilnya sama untuk semua pengunjung. */
export const sessionForward = cache((): SessionForward | null => {
  const h = headers();
  const cookie = h.get('cookie') || '';
  if (!cookie) return null;
  const proto = h.get('x-forwarded-proto') || 'http';
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  return { cookie, origin: h.get('origin') || `${proto}://${host}` };
});
