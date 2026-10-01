import type { ReactNode } from 'react';
import CustomerShell from '@/components/customer/CustomerShell';
import { SiteProvider } from '@/components/SiteProvider';
import { fetchSite } from '@/lib/server-data';
import '@/app/styles/commerce.css';
import '@/app/styles/portal.css';

export const metadata = {
  title: { default: 'Dashboard Customer', template: '%s · Dashboard · PT IKN' },
  robots: { index: false, follow: false },
};

// SiteProvider: pengaturan situs (nomor WhatsApp marketing untuk tombol melayang) ikut tersedia di portal.
export default async function CustomerDashboardLayout({ children }: { children: ReactNode }) {
  const site = await fetchSite();

  return (
    <SiteProvider site={site}>
      <CustomerShell>{children}</CustomerShell>
    </SiteProvider>
  );
}
