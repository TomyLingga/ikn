import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchPage } from '@/lib/server-data';

const SLUG = 'tentang';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Tentang');
}

// Anchors #sejarah, #visi-misi, #nilai are set by the timeline/vision_mission/values sections.
export default async function Tentang() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;

  return <SectionRenderer sections={page.sections} page={{ slug: page.slug, title: page.title }} />;
}
