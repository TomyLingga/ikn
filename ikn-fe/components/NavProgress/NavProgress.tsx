'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Phase = 'idle' | 'loading' | 'done';

// Bilah kemajuan tipis di atas layar: menyala begitu tautan internal diklik dan selesai saat rute berganti,
// supaya pengunjung langsung mendapat tanggapan selagi server menyiapkan halaman berikutnya.
export default function NavProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // Tautan keluar, anchor (#bagian), dan perubahan query di halaman yang sama tidak memicu bilah.
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      setPhase('loading');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Rute berganti = halaman baru sudah dirender.
  useEffect(() => {
    setPhase((current) => (current === 'loading' ? 'done' : current));
  }, [pathname]);

  useEffect(() => {
    if (phase === 'idle') return;
    // 'loading' dibatasi agar bilah tidak menggantung bila klik ternyata tidak berpindah halaman.
    const timer = window.setTimeout(() => setPhase('idle'), phase === 'done' ? 320 : 12000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <div className={`nav-progress is-${phase}`} aria-hidden="true">
      <span />
    </div>
  );
}
