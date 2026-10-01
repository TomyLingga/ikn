import type { ReactNode } from 'react';

export const metadata = {
  title: { default: 'Invoice', template: '%s · PT IKN' },
  robots: { index: false, follow: false },
};

// Halaman cetak (invoice): tanpa navbar/footer/shell; dibuka di tab baru dari portal customer atau panel admin.
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="print-root">{children}</div>;
}
