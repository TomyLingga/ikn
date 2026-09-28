import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchPage } from '@/lib/server-data';

const SLUG = 'whistleblowing';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Whistle Blowing System');
}

// The report form lives in the wbs_form section (client component, POST /wbs).
export default async function Whistleblowing() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;

  return <SectionRenderer sections={page.sections} page={{ slug: page.slug, title: page.title }} />;
}
