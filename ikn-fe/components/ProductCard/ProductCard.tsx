'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import StarRating from '@/components/StarRating';
import { useCart, isSellable } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { stockLabels } from '@/lib/commerce';
import { formatIDR } from '@/lib/format';
import { tr } from '@/lib/cms';
import type { Product } from '@/lib/types';

// Kartu produk katalog: harga efektif (+ coret harga normal saat promo), status stok, tombol keranjang.
export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { customer } = useAuth();
  const { lang } = useLang();
  const [added, setAdded] = useState(false);
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const stock = stockLabels[product.stockStatus] || stockLabels.out_of_stock;
  const sellable = isSellable(product);
  const name = tr(product.name, lang);
  const href = `/catalog/${product.slug}`;
  const promo = product.promoPrice != null && product.price != null && product.promoPrice < product.price;

  function handleAdd() {
    if (!add(product, product.moq || 1)) return;
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
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
