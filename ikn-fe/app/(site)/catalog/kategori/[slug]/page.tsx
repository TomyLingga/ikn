import Breadcrumb from '@/components/Breadcrumb';
import CatalogBrowser, { parseCatalogQuery } from '@/components/CatalogBrowser';
import EmptyState from '@/components/EmptyState';
import { fetchCategories, fetchProducts } from '@/lib/server-data';
import { buildMetadata } from '@/lib/seo';

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const categories = await fetchCategories();
  const c = categories.find((item) => item.slug === params.slug);
  return c
    ? buildMetadata({
        title: `${c.name.id} — Katalog Produk Karet`,
        description: c.description?.id || `Katalog ${c.name.id} PT Industri Karet Nusantara: harga, minimum order, dan stok. Pesan online untuk kebutuhan industri.`,
        path: `/catalog/kategori/${c.slug}`,
      })
    : { title: 'Kategori', robots: { index: false, follow: true } };
}

export default async function CategoryPage({ params, searchParams }: { params: { slug: string }; searchParams: SearchParams }) {
  const query = parseCatalogQuery(searchParams, params.slug);
  const [categories, products] = await Promise.all([fetchCategories(), fetchProducts(query)]);
  const category = categories.find((c) => c.slug === params.slug) || null;

  if (!category) {
    return (
      <section className="section-tight">
        <div className="container">
          <EmptyState
            icon="compass"
            title="Kategori tidak ditemukan"
            body="Kategori yang Anda cari tidak tersedia."
            action={{ href: '/catalog', label: 'Kembali ke katalog' }}
          />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb
            items={[
              { label: 'Beranda', href: '/' },
              { label: 'Katalog', href: '/catalog' },
              { label: category.name.id },
            ]}
          />
          <span className="label label-amber">/ Kategori</span>
          <h1 className="display pagehead-title">{category.name.id}</h1>
          {category.description?.id && <p className="lead" style={{ marginTop: 12, maxWidth: '48ch' }}>{category.description.id}</p>}
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <CatalogBrowser
            products={products.items}
            meta={products.meta}
            categories={categories}
            query={query}
            basePath={`/catalog/kategori/${category.slug}`}
            lockCategory
          />
        </div>
      </section>
    </>
  );
}
