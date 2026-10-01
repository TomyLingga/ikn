import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingContacts from '@/components/FloatingContacts';
import PageTransition from '@/components/PageTransition';
import { SiteProvider } from '@/components/SiteProvider';
import { fetchSite } from '@/lib/server-data';
import JsonLd from '@/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import '@/app/pages.css';
import '@/app/styles/commerce.css';

// Site-wide CMS data (menus, settings, contact, doc links) is fetched once here
// and shared with Navbar/Footer/sections through SiteProvider.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await fetchSite();

  return (
    <SiteProvider site={site}>
      <JsonLd data={[organizationJsonLd(site), websiteJsonLd()]} />
      <Navbar />
      <main className="site-main">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <FloatingContacts />
    </SiteProvider>
  );
}
