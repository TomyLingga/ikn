import EmptyState from '@/components/EmptyState';
import ProductDetail from '@/components/ProductDetail';
import { fetchProduct } from '@/lib/server-data';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug);
  return { title: product ? product.name.id : 'Produk' };
}

// Detail produk di dalam portal customer (GET /catalog/products/{slug}): komponen yang sama dengan situs publik,
// tetapi semua tautannya tetap di /dashboard sehingga customer tidak keluar dari portal.
export default async function CustomerProductPage({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug);

  if (!product) {
    return (
      <EmptyState
        icon="search"
        title="Produk tidak ditemukan"
        body="Produk yang Anda cari tidak tersedia atau sudah tidak dipublikasikan."
        action={{ href: '/dashboard/katalog', label: 'Kembali belanja' }}
      />
    );
  }

  return <ProductDetail product={product} />;
}
