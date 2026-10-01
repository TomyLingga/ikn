import CatalogBrowser, { parseCatalogQuery } from '@/components/CatalogBrowser';
import { fetchCategories, fetchProducts } from '@/lib/server-data';

export const metadata = {
  title: 'Belanja Produk',
  description: 'Beli produk karet industri PT IKN dengan harga khusus customer.',
};

type SearchParams = Record<string, string | string[] | undefined>;

// Katalog di dalam portal customer: kartu produk dan detailnya tetap di /dashboard/katalog (lib/shop.ts).
export default async function CustomerCatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseCatalogQuery(searchParams);
  const [products, categories] = await Promise.all([fetchProducts(query), fetchCategories()]);

  return (
    <div className="shop-page">
      <header className="portal-head">
        <h1>Belanja produk</h1>
        <p>Harga khusus customer dan stok terbaru. Tambahkan ke keranjang, lalu checkout tanpa meninggalkan portal.</p>
      </header>

      <CatalogBrowser products={products.items} meta={products.meta} categories={categories} query={query} basePath="/dashboard/katalog" layout="top" />
    </div>
  );
}
