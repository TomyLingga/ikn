import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchSectionExtra } from '@/lib/section-data';
import { fetchPage } from '@/lib/server-data';
import '@/app/styles/home.css';

const SLUG = 'home';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Beranda');
}

// Beranda: section CMS dibungkus .site-v2 (palet & dasar tipografi bersama, app/styles/site.css) + .home-v2 (tata letak
// khusus beranda, app/styles/home.css). Navbar/Footer di luar pembungkus. `blocks` memberi data-section-key/type untuk CSS.
export default async function Home() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;
  const extra = await fetchSectionExtra(page.sections);

  return (
    <div className="site-v2 home-v2">
      <SectionRenderer sections={page.sections} extra={extra} page={{ slug: page.slug, title: page.title }} blocks />
    </div>
  );
}
