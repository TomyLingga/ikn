import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchGallery, fetchPage } from '@/lib/server-data';

const SLUG = 'galeri';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Galeri');
}

export default async function Galeri() {
  const [page, gallery] = await Promise.all([fetchPage(SLUG), fetchGallery()]);
  if (!page) return <PageFallback />;

  return (
    <SectionRenderer
      sections={page.sections}
      extra={{ gallery }}
      page={{ slug: page.slug, title: page.title }}
    />
  );
}
