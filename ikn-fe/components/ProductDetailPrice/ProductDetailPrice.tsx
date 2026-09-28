'use client';

import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { formatIDR, formatDate } from '@/lib/format';
import type { Product } from '@/lib/types';
import Icon from '@/components/Icon';

// Blok harga di halaman detail: harga efektif, coretan harga normal + masa promo, atau mode penawaran.
export default function ProductDetailPrice({ product }: { product: Product }) {
  const { customer } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  if (!customer) {
    return (
      <div className="pd-price" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--amber)' }}>
        <Icon name="shieldCheck" size={20} />
        <span className="pcard-quote" style={{ fontSize: '1.05rem', color: 'var(--amber)', fontWeight: 600 }}>
          {t('Harga tersedia setelah login', 'Price available after login')}
        </span>
      </div>
    );
  }

  if (product.priceMode !== 'fixed') {
    return (
      <div className="pd-price">
        <span className="pcard-quote">{t('Harga berdasarkan penawaran', 'Price on quotation')}</span>
      </div>
    );
  }

  const promo = product.promoPrice != null && product.price != null && product.promoPrice < product.price;

  return (
    <div className="pd-price-block">
      <div className="pd-price">
        {formatIDR(product.effectivePrice ?? product.price)}<small>/{product.unit}</small>
      </div>
      {promo && (
        <p className="pd-promo">
          <s>{formatIDR(product.price)}</s>
          <span className="pd-promo-badge">{t('Promo', 'Promo')}</span>
          {product.promoEndsAt && (
            <span className="pd-promo-until">
              {t('s.d.', 'until')} {formatDate(product.promoEndsAt, lang)}
            </span>
          )}
        </p>
      )}
      {product.isTaxable === false && (
        <p className="qty-moq">{t('Tidak dikenakan PPN', 'VAT not applicable')}</p>
      )}
    </div>
  );
}
