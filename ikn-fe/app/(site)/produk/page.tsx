import SectionRenderer from '@/components/cms/SectionRenderer';
import PageFallback from '@/components/cms/PageFallback';
import ProductShowcase from '@/components/ProductShowcase';
import { pageMetadata } from '@/components/cms/utils';
import { fetchPage, fetchProducts } from '@/lib/server-data';

const SLUG = 'produk';

export async function generateMetadata() {
  return pageMetadata(await fetchPage(SLUG), 'Produk');
}

// Page header and CTA come from the CMS; the product list comes from GET /catalog/products.
export default async function Produk() {
  const [page, products] = await Promise.all([fetchPage(SLUG), fetchProducts({ perPage: 50 })]);
  if (!page) return <PageFallback />;

  const meta = { slug: page.slug, title: page.title };
  const headers = page.sections.filter((s) => s.type === 'page_header');
  const rest = page.sections.filter((s) => s.type !== 'page_header');

  return (
    <>
      <SectionRenderer sections={headers} page={meta} />

      <section className="section-tight">
        <div className="container">
          <ProductShowcase products={products.items} />
        </div>
      </section>

      <SectionRenderer sections={rest} page={meta} />
    </>
  );
}
