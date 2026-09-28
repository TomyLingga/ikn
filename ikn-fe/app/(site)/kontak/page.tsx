import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchPage } from '@/lib/server-data';

const SLUG = 'kontak';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Kontak');
}

// The contact form lives in the contact_form section (client component).
export default async function Kontak() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;

  return <SectionRenderer sections={page.sections} page={{ slug: page.slug, title: page.title }} />;
}
