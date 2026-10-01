import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import BusinessProducts from '@/components/cms/BusinessProducts';
import { pageMetadata } from '@/components/cms/utils';
import { fetchSectionExtra } from '@/lib/section-data';
import { fetchPage, fetchProducts } from '@/lib/server-data';

const SLUG = 'bisnis';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Bisnis');
}

// Halaman Bisnis (dulu /produk): header + lini bisnis dari CMS, lalu produk dari katalog, lalu kartu tautan,
// unduhan (#unduhan, brosur dari API), dan CTA. Anchor #resiprene-35 / #barang-karet = key section text_visual.
export default async function Bisnis() {
  const page = await fetchPage(SLUG);
  if (!page) return <PageFallback />;
  // Pratinjau produk boleh dari cache konten (tanpa harga/stok); katalog sendiri selalu segar.
  const [extra, products] = await Promise.all([fetchSectionExtra(page.sections), fetchProducts({ perPage: 50 }, { cached: true })]);

  const meta = { slug: page.slug, title: page.title };
  const cut = page.sections.findIndex((s) => s.type === 'link_cards' || s.type === 'brochures' || s.type === 'cta');
  const before = cut === -1 ? page.sections : page.sections.slice(0, cut);
  const after = cut === -1 ? [] : page.sections.slice(cut);

  return (
    <>
      <SectionRenderer sections={before} extra={extra} page={meta} />
      <BusinessProducts products={products.items} />
      <SectionRenderer sections={after} extra={extra} page={meta} />
    </>
  );
}
