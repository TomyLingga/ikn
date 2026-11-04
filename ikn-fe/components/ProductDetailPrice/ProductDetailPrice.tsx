'use client';

import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { FobBadge } from '@/components/ProductCard/ProductCard';
import { priceUnavailable, productPrice } from '@/lib/commerce';
import { formatMoney, formatDate, isUsd } from '@/lib/format';
import type { Product } from '@/lib/types';
import Icon from '@/components/Icon';

// Blok harga di halaman detail: harga efektif, coretan harga normal + masa promo, atau mode penawaran.
// Customer ekspor melihat harga USD basis FOB Belawan (tanpa promo); tanpa harga USD = ajakan menghubungi kami.
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

  const price = productPrice(product);
  if (priceUnavailable(product)) {
    return (
      <div className="pd-price">
        <span className="pcard-quote">{t('Hubungi kami untuk harga', 'Contact us for pricing')}</span>
      </div>
    );
  }

  return (
    <div className="pd-price-block">
      <div className="pd-price">
        {formatMoney(price.amount, price.currency)}<small>/{product.unit}</small>
      </div>
      {isUsd(price.currency) && (
        <p className="pd-promo">
          <FobBadge lang={lang} />
          <span className="pd-promo-until">{t('Trucking ke pelabuhan dan biaya pelabuhan sudah termasuk.', 'Trucking to the port and port charges are included.')}</span>
        </p>
      )}
      {price.promo && (
        <p className="pd-promo">
          <s>{formatMoney(price.base, price.currency)}</s>
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
