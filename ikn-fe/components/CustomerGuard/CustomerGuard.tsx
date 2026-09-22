'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import SessionLoader from '@/components/SessionLoader';

// Guard area customer. Sesi customer dan admin bisa hidup berdampingan
// (guard backend terpisah), jadi keberadaan sesi admin TIDAK menghalangi
// akses area customer — hanya tanpa sesi customer yang dialihkan.
export default function CustomerGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { customer, admin, ready } = useAuth();

  useEffect(() => {
    if (!ready || customer) return;
    // Admin yang membuka area customer diarahkan ke back-office;
    // pengunjung tanpa sesi diminta login dulu.
    if (admin) {
      router.replace('/admin');
      return;
    }
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, customer, admin, pathname, router]);

  if (!ready || !customer) {
    return <SessionLoader message="Memuat sesi customer..." portalName="Portal Customer" />;
  }

  return children;
}
