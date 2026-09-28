import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchCustomerLogos, fetchPage } from '@/lib/server-data';

const SLUG = 'pelanggan';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Pelanggan Kami');
}

export default async function Pelanggan() {
  const [page, customerLogos] = await Promise.all([fetchPage(SLUG), fetchCustomerLogos()]);
  if (!page) return <PageFallback />;

  return (
    <SectionRenderer
      sections={page.sections}
      extra={{ customerLogos }}
      page={{ slug: page.slug, title: page.title }}
    />
  );
}
