import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchSectionExtra } from '@/lib/section-data';
import { fetchPage } from '@/lib/server-data';

const SLUG = 'galeri';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Galeri');
}

// Item galeri (section gallery) diambil fetchSectionExtra dari GET /content/gallery.
export default async function Galeri() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;
  const extra = await fetchSectionExtra(page.sections);

  return <SectionRenderer sections={page.sections} extra={extra} page={{ slug: page.slug, title: page.title }} />;
}
