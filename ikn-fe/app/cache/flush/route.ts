import { NextResponse } from 'next/server';
import { flushContentCache } from '@/lib/server-data';

export const dynamic = 'force-dynamic';

// POST /cache/flush: mengosongkan cache konten di proses server Next (lib/server-data.ts).
// Dipanggil lib/api.ts setelah tiap aksi tulis admin agar perubahan CMS langsung tampil di situs publik.
// Tidak membawa data apa pun; efeknya hanya membuat permintaan berikutnya mengambil ulang dari API.
export function POST() {
  flushContentCache();
  return NextResponse.json({ flushed: true });
}
