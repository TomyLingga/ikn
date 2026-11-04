import EmptyState from '@/components/EmptyState';
import ProductDetail from '@/components/ProductDetail';
import { fetchProduct } from '@/lib/server-data';
import { sessionForward } from '@/lib/server-session';
import JsonLd from '@/components/JsonLd';
import { breadcrumbJsonLd, buildMetadata, productJsonLd } from '@/lib/seo';

// Metadata selalu dari bentuk publik (rupiah) agar judul/deskripsi SEO sama untuk semua pengunjung dan mesin pencari.
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug, null);
  if (!product) return { title: 'Produk', robots: { index: false, follow: true } };
  // Harga & MOQ di depan agar tidak terpotong di hasil Google; ringkasan menyusul.
  const price = product.priceMode === 'fixed' && (product.effectivePrice ?? product.price) != null
    ? `Rp ${(product.effectivePrice ?? product.price ?? 0).toLocaleString('id-ID')}/${product.unit}, min. order ${product.moq} ${product.unit}.`
    : 'Harga berdasarkan penawaran.';
  const summary = (product.summary?.id || '').trim().replace(/[.\s]+$/, '');
  return buildMetadata({
    title: `${product.name.id}${product.category ? ` | ${product.category.name.id}` : ''}`,
    description: `${product.name.id} ${price} ${summary ? `${summary}. ` : ''}Langsung dari pabrik PT Industri Karet Nusantara, Medan.`,
    path: `/catalog/${product.slug}`,
    image: product.image,
  });
}

// RSC hanya mengambil data (GET /catalog/products/{slug}); tampilan bilingual di komponen klien.
// Sesi pengunjung diteruskan agar customer ekspor yang login melihat harga USD (tamu = jalur publik, ASUMSI A-86).
export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug, sessionForward());

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

  return (
    <>
      <JsonLd
        data={[
          productJsonLd(product),
          breadcrumbJsonLd([
            { name: 'Beranda', path: '/' },
            { name: 'Katalog', path: '/catalog' },
            ...(product.category ? [{ name: product.category.name.id, path: `/catalog/kategori/${product.category.slug}` }] : []),
            { name: product.name.id, path: `/catalog/${product.slug}` },
          ]),
        ]}
      />
      <ProductDetail product={product} />
    </>
  );
}
