import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchCertificates, fetchPage } from '@/lib/server-data';

const SLUG = 'sertifikat';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Sertifikat');
}

export default async function Sertifikat() {
  const [page, certificates] = await Promise.all([fetchPage(SLUG), fetchCertificates()]);
  if (!page) return <PageFallback />;

  return (
    <SectionRenderer
      sections={page.sections}
      extra={{ certificates }}
      page={{ slug: page.slug, title: page.title }}
    />
  );
}
