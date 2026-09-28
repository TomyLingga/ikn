import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchBrochures, fetchPage } from '@/lib/server-data';

const SLUG = 'unduhan';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Unduhan');
}

export default async function Unduhan() {
  const [page, brochures] = await Promise.all([fetchPage(SLUG), fetchBrochures()]);
  if (!page) return <PageFallback />;

  return (
    <SectionRenderer
      sections={page.sections}
      extra={{ brochures }}
      page={{ slug: page.slug, title: page.title }}
    />
  );
}
