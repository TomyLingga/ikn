'use client';

import Icon from '@/components/Icon';
import ProductShowcase from '@/components/ProductShowcase';
import SmartLink from './SmartLink';
import SecHead from './sections/SecHead';
import { useLang } from '@/components/LanguageProvider';
import type { Product } from '@/lib/types';

// shortcut: pilihan produk tertulis di kode (slug); bila admin perlu mengaturnya sendiri, jadikan field CMS.
// Urutan = tampilan: pertama kartu besar, sisanya kartu kecil. Slug yang hilang diganti produk terbit lain.
const FEATURED = ['resiprene-35', 'sarung-egrek', 'sepatu-boots', 'packing-pintu-rebusan', 'rubber-membrane'];

// Blok "Produk kami" di halaman Bisnis: 5 produk terbit dari katalog (GET /catalog/products) + tautan ke katalog.
export default function BusinessProducts({ products: all }: { products: Product[] }) {
  const { lang } = useLang();
  const products = [
    ...FEATURED.flatMap((slug) => all.filter((p) => p.slug === slug)),
    ...all.filter((p) => !FEATURED.includes(p.slug)),
  ].slice(0, 5);
  if (products.length === 0) return null;

  return (
    <section className="section-tight" id="produk">
      <div className="container">
        <SecHead
          label={lang === 'en' ? '/ Our products' : '/ Produk kami'}
          heading={lang === 'en' ? 'Ready to order from the catalog.' : 'Siap dipesan dari katalog.'}
          aside={
            <SmartLink href="/catalog" className="link">
              {lang === 'en' ? 'Open catalog' : 'Buka katalog'} <Icon name="arrow" />
            </SmartLink>
          }
        />
        <ProductShowcase products={products} />
        {/* Toko (harga, keranjang, checkout) tetap di /catalog; blok ini pratinjau produk (menu "Katalog Produk" menuju #produk). */}
        <div className="biz-products-cta">
          <SmartLink href="/catalog" className="btn btn-solid">
            {lang === 'en' ? 'Open the full catalog & order online' : 'Buka katalog lengkap & pesan online'} <Icon name="arrow" />
          </SmartLink>
          <span className="biz-products-note">
            {lang === 'en' ? 'Prices and stock appear after logging in as a business customer.' : 'Harga dan stok tampil setelah login sebagai pelanggan perusahaan.'}
          </span>
        </div>
      </div>
    </section>
  );
}
