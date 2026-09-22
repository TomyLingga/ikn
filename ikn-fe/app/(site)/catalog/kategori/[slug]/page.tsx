import Breadcrumb from '@/components/Breadcrumb';
import CatalogBrowser from '@/components/CatalogBrowser';
import EmptyState from '@/components/EmptyState';
import { fetchCategories, fetchProducts } from '@/lib/server-data';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const categories = await fetchCategories();
  const c = categories.find((item) => item.slug === params.slug);
  return c ? { title: `${c.name} — Katalog`, description: c.desc } : { title: 'Kategori' };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const [categories, products] = await Promise.all([
    fetchCategories(),
    fetchProducts({ category: params.slug }),
  ]);
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
              { label: category.name },
            ]}
          />
          <span className="label label-amber">/ Kategori</span>
          <h1 className="display pagehead-title">{category.name}</h1>
          <p className="lead" style={{ marginTop: 12, maxWidth: '48ch' }}>{category.desc}</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <CatalogBrowser products={products} categories={categories} initialCategory={category.slug} />
        </div>
      </section>
    </>
  );
}
