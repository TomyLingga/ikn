'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import StarRating from '@/components/StarRating';
import { useCart, isSellable } from '@/components/CartProvider';
import { openChat } from '@/lib/shop';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { stockLabels } from '@/lib/commerce';
import { formatIDR } from '@/lib/format';
import { tr } from '@/lib/cms';
import { useShopPaths } from '@/lib/shop';
import type { Product } from '@/lib/types';

// Kartu produk katalog: harga efektif (+ coret harga normal saat promo), status stok, tombol keranjang.
export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { customer } = useAuth();
  const { lang } = useLang();
  const shop = useShopPaths();
  const [added, setAdded] = useState(false);
  const moq = Math.max(1, product.moq || 1);
  const [qty, setQty] = useState(moq);
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const stock = stockLabels[product.stockStatus] || stockLabels.out_of_stock;
  const sellable = isSellable(product);
  const name = tr(product.name, lang);
  // Di portal customer tautan tetap di portal (/dashboard/katalog/{slug}); di situs publik ke /catalog/{slug}.
  const href = shop.product(product.slug);
  const promo = product.promoPrice != null && product.price != null && product.promoPrice < product.price;

  // Portal customer: quick add uses the quantity stepper (never below MOQ, never above available stock).
  const portalCard = shop.portal && !!customer;
  const maxQty = product.stockStatus === 'made_to_order' ? Number.POSITIVE_INFINITY : Math.max(moq, product.available);
  const clamp = (v: number) => Math.min(Math.max(moq, Math.floor(v) || moq), maxQty);
  const discount = promo && product.price ? Math.round((1 - (product.promoPrice as number) / product.price) * 100) : 0;
  const askSeller = () => openChat({ type: 'product', slug: product.slug, label: name, image: product.image });

  function handleAdd() {
    if (!add(product, portalCard ? clamp(qty) : moq)) return;
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  if (portalCard) {
    const quote = product.priceMode !== 'fixed';
    const soldOut = !quote && !sellable;
    return (
      <article className={`pcard pcard-portal ${soldOut ? 'is-soldout' : ''}`}>
        <Link href={href} className="pcard-media">
          {product.image ? (
            <Image src={product.image} alt={name} fill sizes="(max-width:620px) 50vw, (max-width:1200px) 33vw, 260px" />
          ) : (
            <span className="pcard-drop"><Icon name="drop" size={48} strokeWidth={1} /></span>
          )}
          <span className="pcard-code">{product.code}</span>
          <span className="pcard-flags">
            {promo && <span className="pcard-flag is-promo">{discount > 0 ? `−${discount}%` : t('Promo', 'Promo')}</span>}
            {quote && <span className="pcard-flag is-quote">{t('Penawaran', 'Quote')}</span>}
            {product.stockStatus === 'made_to_order' && <span className="pcard-flag is-po">Pre-order</span>}
          </span>
          {soldOut && <span className="pcard-soldout">{t('Stok habis', 'Out of stock')}</span>}
          {product.hasVideo && (
            <span className="pcard-video" title={t('Ada video produk', 'Has a product video')}>
              <Icon name="play" size={11} /> Video
            </span>
          )}
        </Link>

        <div className="pcard-body">
          <span className="pcard-kind">{product.kind || tr(product.category?.name, lang)}</span>
          <h3 className="pcard-name">
            <Link href={href}>{name}</Link>
          </h3>
          {/* Fixed-height rating row keeps prices aligned across cards with and without reviews. */}
          <div className="pcard-rating">
            {product.reviewCount > 0 ? <StarRating value={product.ratingAvg} count={product.reviewCount} size={13} /> : <span>{t('Belum ada ulasan', 'No reviews yet')}</span>}
          </div>

          <div className="pcard-price-row">
            {quote ? (
              <span className="pcard-quote">{t('Harga sesuai penawaran', 'Price on quotation')}</span>
            ) : (
              <>
                {promo && <s className="pcard-price-old">{formatIDR(product.price)}</s>}
                <span className="pcard-price">
                  {formatIDR(product.effectivePrice ?? product.price)}
                  <small>/{product.unit}</small>
                </span>
              </>
            )}
          </div>

          <ul className="pcard-facts">
            {product.stockStatus === 'in_stock' && (
              <li className="is-ok">
                <i aria-hidden="true" /> {t('Stok', 'Stock')} {product.available.toLocaleString('id-ID')} {product.unit}
              </li>
            )}
            {product.stockStatus === 'made_to_order' && (
              <li className="is-warn">
                <i aria-hidden="true" /> {t('Dibuat sesuai pesanan', 'Made to order')}
              </li>
            )}
            {product.stockStatus === 'out_of_stock' && !quote && (
              <li className="is-bad">
                <i aria-hidden="true" /> {stock[lang] || stock.id}
              </li>
            )}
            {!quote && (
              <li>
                {t('Min. order', 'Min. order')} {moq.toLocaleString('id-ID')} {product.unit}
              </li>
            )}
          </ul>

          <div className="pcard-buy">
            {sellable ? (
              <>
                <div className="pcard-qty" role="group" aria-label={`${t('Jumlah', 'Quantity')} (${product.unit})`}>
                  <button type="button" onClick={() => setQty((v) => clamp(v - 1))} disabled={qty <= moq} aria-label={t('Kurangi', 'Decrease')}>
                    <Icon name="minus" size={14} />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={moq}
                    max={Number.isFinite(maxQty) ? maxQty : undefined}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value) || moq)}
                    onBlur={() => setQty((v) => clamp(v))}
                    aria-label={t('Jumlah', 'Quantity')}
                  />
                  <button type="button" onClick={() => setQty((v) => clamp(v + 1))} disabled={qty >= maxQty} aria-label={t('Tambah', 'Increase')}>
                    <Icon name="plus" size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  className={`pcard-cart ${added ? 'is-added' : ''}`}
                  aria-label={`${t('Tambah', 'Add')} ${name} ${t('ke keranjang', 'to cart')}`}
                  title={t('Tambah ke keranjang', 'Add to cart')}
                  onClick={handleAdd}
                >
                  <Icon name={added ? 'check' : 'bag'} size={17} />
                  <span>{added ? t('Masuk', 'Added') : t('Keranjang', 'Cart')}</span>
                </button>
              </>
            ) : (
              <button type="button" className={`pcard-ask ${quote ? 'is-quote' : ''}`} onClick={askSeller}>
                <Icon name="chat" size={16} /> {quote ? t('Minta penawaran', 'Request a quote') : t('Tanya stok', 'Ask about stock')}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="pcard">
      <Link href={href} className="pcard-media">
        {product.image ? (
          <Image src={product.image} alt={name} fill sizes="(max-width:900px) 50vw, 300px" />
        ) : (
          <span className="pcard-drop"><Icon name="drop" size={48} strokeWidth={1} /></span>
        )}
        <span className="pcard-code">{product.code}</span>
        {promo && <span className="pcard-promo">{t('Promo', 'Promo')}</span>}
        {product.hasVideo && (
          <span className="pcard-video" title={t('Ada video produk', 'Has a product video')}>
            <Icon name="play" size={11} /> Video
          </span>
        )}
      </Link>

      <div className="pcard-body">
        <span className="pcard-kind">{product.kind || tr(product.category?.name, lang)}</span>
        <h3 className="pcard-name">
          <Link href={href}>{name}</Link>
        </h3>

        <div className="pcard-meta">
          <StatusBadge label={stock[lang] || stock.id} tone={stock.tone} small />
          {product.reviewCount > 0 && <StarRating value={product.ratingAvg} count={product.reviewCount} />}
        </div>
        {customer && product.stockStatus === 'in_stock' && (
          <span className="pcard-stock">{t('Tersedia', 'Available')} {product.available.toLocaleString('id-ID')} {product.unit}</span>
        )}

        <div className="pcard-foot">
          <span className="pcard-price">
            {customer ? (
              product.priceMode === 'fixed' ? (
                <>
                  {promo && <s className="pcard-price-old">{formatIDR(product.price)}</s>}
                  {formatIDR(product.effectivePrice ?? product.price)}<small>/{product.unit}</small>
                </>
              ) : (
                <span className="pcard-quote">{t('Harga penawaran', 'Quote on request')}</span>
              )
            ) : (
              <span className="pcard-quote" style={{ color: 'var(--amber)' }}>
                {t('Harga tersedia setelah login', 'Price available after login')}
              </span>
            )}
          </span>

          {customer ? (
            sellable ? (
              <button
                type="button"
                className={`pcard-add ${added ? 'is-added' : ''}`}
                aria-label={`${t('Tambah', 'Add')} ${name} ${t('ke keranjang', 'to cart')}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleAdd();
                }}
              >
                <Icon name={added ? 'check' : 'plus'} size={18} />
              </button>
            ) : (
              <Link href={href} className="pcard-add pcard-add-view" aria-label={t('Lihat detail', 'View details')}>
                <Icon name="arrow" size={18} />
              </Link>
            )
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(href)}`}
              className="pcard-add pcard-add-login"
              aria-label={t('Login untuk memesan', 'Login to order')}
              title={t('Login untuk memesan', 'Login to order')}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="arrow" size={18} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
