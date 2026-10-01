import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchSectionExtra } from '@/lib/section-data';
import { fetchPage } from '@/lib/server-data';

const SLUG = 'keberlanjutan';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Keberlanjutan');
}

// Satu halaman: pilar ESG (#esg), sertifikat (#sertifikat), pelanggan (#pelanggan), REACH (#reach),
// whistle blowing (#whistleblowing + formulir). Anchor = key section; data daftar dari API lewat fetchSectionExtra.
export default async function Keberlanjutan() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;
  const extra = await fetchSectionExtra(page.sections);

  return <SectionRenderer sections={page.sections} extra={extra} page={{ slug: page.slug, title: page.title }} />;
}
