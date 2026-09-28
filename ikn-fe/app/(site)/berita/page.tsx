import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchNews, fetchPage } from '@/lib/server-data';

const SLUG = 'berita';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Berita');
}

export default async function Berita() {
  const [page, news] = await Promise.all([fetchPage(SLUG), fetchNews()]);
  if (!page) return <PageFallback />;

  return (
    <SectionRenderer
      sections={page.sections}
      extra={{ news }}
      page={{ slug: page.slug, title: page.title }}
    />
  );
}
