import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import MediaTeasers from '@/components/cms/MediaTeasers';
import { pageMetadata } from '@/components/cms/utils';
import { fetchSectionExtra } from '@/lib/section-data';
import { fetchGallery, fetchNews, fetchPage } from '@/lib/server-data';

const SLUG = 'media';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Media');
}

// Halaman hub Media: header + kartu ke Berita dan Galeri dari CMS, lalu teaser berita terbaru dan foto terbaru.
export default async function Media() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;
  const [extra, news, gallery] = await Promise.all([fetchSectionExtra(page.sections), fetchNews(), fetchGallery()]);

  const photos = gallery.filter((g) => g.type === 'image' && !!g.media?.url).slice(0, 6);

  return (
    <>
      <SectionRenderer sections={page.sections} extra={extra} page={{ slug: page.slug, title: page.title }} />
      <MediaTeasers news={news.slice(0, 3)} photos={photos} />
    </>
  );
}
