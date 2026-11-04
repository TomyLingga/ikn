import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchSectionExtra } from '@/lib/section-data';
import { fetchPage } from '@/lib/server-data';

const SLUG = 'media';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Berita & Media');
}

// Halaman Berita & Media: berita terbaru (latest_news), kegiatan & galeri (image_grid), dan video dari CMS.
export default async function Media() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;
  const extra = await fetchSectionExtra(page.sections);

  return (
    <div className="site-v2 page-v2">
      <SectionRenderer sections={page.sections} extra={extra} page={{ slug: page.slug, title: page.title }} blocks />
    </div>
  );
}
