'use client';

import Icon from '@/components/Icon';
import ProductShowcase from '@/components/ProductShowcase';
import SmartLink from './SmartLink';
import SecHead from './sections/SecHead';
import { useLang } from '@/components/LanguageProvider';
import type { Product } from '@/lib/types';

// Blok "Produk kami" di halaman Bisnis: daftar produk terbit dari katalog (GET /catalog/products) + tautan ke katalog.
export default function BusinessProducts({ products }: { products: Product[] }) {
  const { lang } = useLang();
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
