import type { ReactNode } from 'react';
import { SiteProvider } from '@/components/SiteProvider';
import { fetchSite } from '@/lib/server-data';

// Grup halaman auth: SiteProvider agar panel foto (components/auth/AuthVisual) memakai slide dari Pengaturan Situs.
export default async function AuthGroupLayout({ children }: { children: ReactNode }) {
  const site = await fetchSite();
  return <SiteProvider site={site}>{children}</SiteProvider>;
}
