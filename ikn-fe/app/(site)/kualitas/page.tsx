import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchSectionExtra } from '@/lib/section-data';
import { fetchPage } from '@/lib/server-data';

const SLUG = 'kualitas';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Kualitas & Inovasi');
}

// Kualitas & Inovasi: jaminan mutu, riset & pengembangan, laboratorium & pengujian, sertifikasi. Tidak ada di navbar (tetap 6 menu); ditautkan dari footer dan halaman terkait.
export default async function Page() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;
  const extra = await fetchSectionExtra(page.sections);

  return (
    <div className="site-v2 page-v2">
      <SectionRenderer sections={page.sections} extra={extra} page={{ slug: page.slug, title: page.title }} blocks />
    </div>
  );
}
