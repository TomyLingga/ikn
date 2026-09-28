import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchPage } from '@/lib/server-data';

const SLUG = 'reach';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'REACH Compliance');
}

export default async function Reach() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;

  return <SectionRenderer sections={page.sections} page={{ slug: page.slug, title: page.title }} />;
}
