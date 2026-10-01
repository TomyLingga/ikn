'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// Halaman baru langsung tampil dengan fade-in singkat (key = pathname memicu ulang animasi).
// Tidak ada fade-out: menunggu animasi keluar menahan halaman baru ~0,3 dtk padahal datanya sudah tiba,
// dan menimpa gulir ke anchor (#bagian) yang dilakukan router.
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
