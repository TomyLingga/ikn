import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import { pageMetadata } from '@/components/cms/utils';
import { fetchSectionExtra } from '@/lib/section-data';
import { fetchNews, fetchNewsCategories, fetchPage } from '@/lib/server-data';

const SLUG = 'berita';

interface Props {
  searchParams?: { category?: string };
}

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Berita');
}

// Daftar berita dengan filter kategori (?category=slug). Header dari CMS, item dari API.
export default async function Berita({ searchParams }: Props) {
  const category = (searchParams?.category || '').trim() || null;
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;
  const [extra, news, categories] = await Promise.all([
    fetchSectionExtra(page.sections),
    fetchNews({ category: category ?? undefined }),
    fetchNewsCategories(),
  ]);

  return (
    <SectionRenderer
      sections={page.sections}
      extra={{ ...extra, news, newsCategories: categories, activeCategory: category }}
      page={{ slug: page.slug, title: page.title }}
    />
  );
}
