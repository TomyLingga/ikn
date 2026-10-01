import { notFound } from 'next/navigation';
import SectionRenderer from '@/components/cms/SectionRenderer';
import { pageMetadata } from '@/components/cms/utils';
import { fetchSectionExtra } from '@/lib/section-data';
import { fetchPage } from '@/lib/server-data';

// Halaman CMS buatan admin (bukan halaman bawaan): /{slug}.
// Rute statis (tentang, kontak, berita, dsb.) tetap diprioritaskan Next.js di atas rute dinamis ini.
// Draf atau slug yang tidak ada -> 404, karena API publik hanya mengembalikan halaman terbit.

interface Params {
  params: { slug: string };
}

export async function generateMetadata({ params }: Params) {
  return pageMetadata(await fetchPage(params.slug), params.slug);
}

export default async function CustomPage({ params }: Params) {
  const page = await fetchPage(params.slug);
  if (!page) notFound();
  const extra = await fetchSectionExtra(page.sections);

  return <SectionRenderer sections={page.sections} extra={extra} page={{ slug: page.slug, title: page.title }} />;
}
