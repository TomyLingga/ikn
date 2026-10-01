'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { useCart, isSellable } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { openCartDrawer, openChat, useShopPaths } from '@/lib/shop';
import { tr } from '@/lib/cms';
import type { Product } from '@/lib/types';

// Kontrol qty + tombol tambah keranjang di halaman detail produk.
// Menghormati `moq` (minimum order) dan `available` (stok − reservasi).
export default function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const { customer } = useAuth();
  const { lang } = useLang();
  const router = useRouter();
  const shop = useShopPaths();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const askSeller = () => openChat({ type: 'product', slug: product.slug, label: tr(product.name, lang), image: product.image });
  const moq = Math.max(1, product.moq || 1);
  const [qty, setQty] = useState(moq);
  const [added, setAdded] = useState(false);

  if (!customer) {
    return (
      <div className="pd-buy">
        <div className="pd-login-note">
          <strong>
            <Icon name="shieldCheck" size={18} /> {t('Harga & pemesanan khusus customer', 'Pricing & ordering for customers')}
          </strong>
          <p>
            {t(
              'Harga khusus customer, minimum order, dan stok tersedia setelah Anda login.',
              'Customer pricing, minimum order and stock are shown after you log in.',
            )}
          </p>
        </div>
        <div className="pd-buy-actions">
          <Link href={`/login?redirect=${encodeURIComponent(shop.product(product.slug))}`} className="btn btn-solid btn-block">
            {t('Login untuk memesan', 'Login to order')} <Icon name="arrow" />
          </Link>
        </div>
      </div>
    );
  }

  if (product.priceMode === 'quote') {
    return (
      <div className="pd-buy">
        <p className="pd-quote-note">
          {t(
            'Produk ini dijual berdasarkan spesifikasi. Hubungi tim marketing kami untuk penawaran dan ketersediaan.',
            'This product is sold to specification. Contact our marketing team for a quotation and availability.',
          )}
        </p>
        {shop.portal ? (
          <button type="button" className="btn btn-solid btn-block" onClick={askSeller}>
            <Icon name="chat" /> {t('Minta penawaran lewat chat', 'Request a quote via chat')}
          </button>
        ) : (
          <Link href={`/kontak?type=quote&product=${encodeURIComponent(product.slug)}`} className="btn btn-solid btn-block">
            {t('Minta penawaran', 'Request a quote')} <Icon name="arrow" />
          </Link>
        )}
      </div>
    );
  }

  const sellable = isSellable(product);
  if (!sellable) {
    return (
      <div className="pd-buy">
        <p className="pd-quote-note">
          {t(
            'Stok produk ini sedang tidak tersedia. Hubungi tim kami untuk informasi ketersediaan.',
            'This product is currently out of stock. Contact our team for availability.',
          )}
        </p>
        {shop.portal ? (
          <button type="button" className="btn btn-line btn-block" onClick={askSeller}>
            <Icon name="chat" /> {t('Tanya ketersediaan lewat chat', 'Ask about availability via chat')}
          </button>
        ) : (
          <Link href={`/kontak?type=stock&product=${encodeURIComponent(product.slug)}`} className="btn btn-line btn-block">
            {t('Tanya ketersediaan', 'Ask about availability')} <Icon name="arrow" />
          </Link>
        )}
      </div>
    );
  }

  const maxQty = product.stockStatus === 'made_to_order' ? Number.POSITIVE_INFINITY : product.available;
  const clamp = (v: number) => Math.min(Math.max(moq, Math.floor(v) || moq), Math.max(moq, maxQty));

  function handleAdd() {
    if (!add(product, clamp(qty))) return;
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  // "Beli sekarang": masukkan ke keranjang lalu langsung ke checkout (di portal tetap di dalam portal).
  function handleBuyNow() {
    if (!add(product, clamp(qty))) return;
    router.push(shop.checkout);
  }

  return (
    <div className="pd-buy">
      <div className="qty-row">
        <span className="qty-label">{t('Jumlah', 'Quantity')} ({product.unit})</span>
        <div className="qty-ctl">
          <button type="button" onClick={() => setQty((v) => clamp(v - 1))} aria-label={t('Kurangi', 'Decrease')}>−</button>
          <input
            type="number"
            min={moq}
            max={Number.isFinite(maxQty) ? maxQty : undefined}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value) || moq)}
            onBlur={() => setQty((v) => clamp(v))}
            aria-label={t('Jumlah', 'Quantity')}
          />
          <button type="button" onClick={() => setQty((v) => clamp(v + 1))} aria-label={t('Tambah', 'Increase')}>+</button>
        </div>
      </div>
      <p className="qty-moq">
        {moq > 1 && <>{t('Minimum order', 'Minimum order')}: {moq} {product.unit}. </>}
        {product.stockStatus === 'made_to_order'
          ? t('Dibuat sesuai pesanan.', 'Made to order.')
          : <>{t('Tersedia', 'Available')}: {product.available.toLocaleString('id-ID')} {product.unit}.</>}
      </p>

      {shop.portal ? (
        <>
          <div className="pd-buy-actions pd-buy-row">
            <button type="button" className="btn btn-line btn-block" onClick={handleAdd}>
              {added ? <>{t('Ditambahkan', 'Added')} <Icon name="check" /></> : <><Icon name="bag" /> {t('Tambah ke keranjang', 'Add to cart')}</>}
            </button>
            <button type="button" className="btn btn-solid btn-block" onClick={handleBuyNow}>
              {t('Beli sekarang', 'Buy now')} <Icon name="arrow" />
            </button>
          </div>
          <div className="pd-buy-links">
            <button type="button" className="pd-text-btn" onClick={askSeller}>
              <Icon name="chat" size={16} /> {t('Chat penjual', 'Chat with seller')}
            </button>
            <button type="button" className="pd-text-btn" onClick={openCartDrawer}>
              <Icon name="bag" size={16} /> {t('Lihat keranjang', 'View cart')}
            </button>
          </div>
        </>
      ) : (
        <div className="pd-buy-actions">
          <button type="button" className="btn btn-solid btn-block" onClick={handleAdd}>
            {added ? <>{t('Ditambahkan', 'Added')} <Icon name="check" /></> : <>{t('Tambah ke keranjang', 'Add to cart')} <Icon name="plus" /></>}
          </button>
          <Link href={shop.cart} className="btn btn-line btn-block">
            {t('Lihat keranjang', 'View cart')} <Icon name="arrow" />
          </Link>
        </div>
      )}
    </div>
  );
}
