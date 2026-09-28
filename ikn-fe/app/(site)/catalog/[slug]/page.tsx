import EmptyState from '@/components/EmptyState';
import ProductDetail from '@/components/ProductDetail';
import { fetchProduct } from '@/lib/server-data';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug);
  return product
    ? { title: product.name.id, description: product.summary?.id || '' }
    : { title: 'Produk' };
}

// RSC hanya mengambil data (GET /catalog/products/{slug}); tampilan bilingual di komponen klien.
export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug);

  if (!product) {
    return (
      <section className="section-tight">
        <div className="container">
          <EmptyState
            icon="compass"
            title="Produk tidak ditemukan"
            body="Produk yang Anda cari tidak tersedia atau sudah tidak dipublikasikan."
            action={{ href: '/catalog', label: 'Kembali ke katalog' }}
          />
        </div>
      </section>
    );
  }

  return <ProductDetail product={product} />;
}
