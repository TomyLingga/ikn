import Breadcrumb from '@/components/Breadcrumb';
import CatalogBrowser, { parseCatalogQuery } from '@/components/CatalogBrowser';
import { fetchCategories, fetchProducts } from '@/lib/server-data';

export const metadata = {
  title: 'Katalog Produk',
  description:
    'Katalog produk hilir karet PT Industri Karet Nusantara — Resiprene 35 dan aneka barang karet industri.',
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseCatalogQuery(searchParams);
  const [products, categories] = await Promise.all([fetchProducts(query), fetchCategories()]);

  return (
    <>
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Katalog' }]} />
          <span className="label label-amber">/ Katalog</span>
          <h1 className="display pagehead-title">Produk karet hilir.</h1>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <CatalogBrowser products={products.items} meta={products.meta} categories={categories} query={query} basePath="/catalog" />
        </div>
      </section>
    </>
  );
}
