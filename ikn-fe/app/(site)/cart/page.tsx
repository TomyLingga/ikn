'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Icon from '@/components/Icon';
import Breadcrumb from '@/components/Breadcrumb';
import EmptyState from '@/components/EmptyState';
import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { formatIDR } from '@/lib/format';
import type { QuoteResult } from '@/lib/types';

// Keranjang: item dari localStorage; ringkasan (harga berlaku, diskon, pajak, biaya) dari
// POST /cart/quote tanpa alamat untuk customer login. Tamu diarahkan login saat checkout.
export default function CartPage() {
  const { items, updateQty, remove, subtotal, count, ready } = useCart();
  const { customer, ready: authReady } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);

  const itemsKey = items.map((i) => `${i.slug}:${i.qty}`).join('|');

  useEffect(() => {
    if (!ready || !authReady || !customer || items.length === 0) {
      setQuote(null);
      return;
    }
    let active = true;
    setQuoting(true);
    setQuoteError('');
    api<QuoteResult>('/cart/quote', {
      method: 'POST',
      body: { items: items.map((i) => ({ productSlug: i.slug, qty: i.qty })) },
    })
      .then((res) => {
        if (active) setQuote(res);
      })
      .catch((err) => {
        if (!active) return;
        setQuote(null);
        setQuoteError(errorMessage(err, t('Ringkasan belum bisa dihitung.', 'Summary could not be calculated.')));
      })
      .finally(() => {
        if (active) setQuoting(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, ready, authReady, customer?.id]);

  const quoteItem = (slug: string) => quote?.items.find((q) => q.productSlug === slug) || null;
  const checkoutHref = customer ? '/checkout' : '/login?next=/checkout';

  return (
    <>
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb items={[{ label: t('Beranda', 'Home'), href: '/' }, { label: t('Keranjang', 'Cart') }]} />
          <span className="label label-amber">/ {t('Keranjang', 'Cart')}</span>
          <h1 className="display pagehead-title">{t('Keranjang belanja.', 'Shopping cart.')}</h1>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          {ready && items.length === 0 ? (
            <EmptyState
              icon="drop"
              title={t('Keranjang masih kosong', 'Your cart is empty')}
              body={t(
                'Jelajahi katalog produk hilir karet kami dan tambahkan produk ke keranjang.',
                'Browse our downstream rubber catalog and add products to your cart.',
              )}
              action={{ href: '/catalog', label: t('Lihat katalog', 'View catalog') }}
            />
          ) : (
            <div className="cart-grid">
              <div className="cart-items">
                {items.map((it) => {
                  const q = quoteItem(it.slug);
                  const unitPrice = q?.unitPrice ?? it.unitPrice;
                  const lineTotal = q?.lineTotal ?? (it.unitPrice || 0) * it.qty;
                  const name = tr(it.name, lang);
                  const overStock = q ? q.qty > q.available : false;
                  return (
                    <div key={it.slug} className="cart-row">
                      <Link href={`/catalog/${it.slug}`} className="cart-thumb">
                        {it.image ? (
                          <Image src={it.image} alt={name} fill sizes="88px" style={{ objectFit: 'cover' }} />
                        ) : (
                          <Icon name="drop" size={28} />
                        )}
                      </Link>
                      <div className="cart-info">
                        <span className="pcard-kind">{it.code}</span>
                        <h3 className="cart-name">
                          <Link href={`/catalog/${it.slug}`}>{name}</Link>
                        </h3>
                        <span className="cart-unit-price">
                          {formatIDR(unitPrice)}/{it.unit}
                          {q?.promoApplied && <span className="pcard-promo-inline">{t('Promo', 'Promo')}</span>}
                        </span>
                        {it.moq > 1 && <span className="cart-moq">{t('Min.', 'Min.')} {it.moq} {it.unit}</span>}
                        {overStock && (
                          <span className="cart-warn">
                            {t('Stok tersedia', 'Available stock')}: {q?.available} {it.unit}
                          </span>
                        )}
                      </div>
                      <div className="qty-ctl qty-ctl-sm">
                        <button type="button" onClick={() => updateQty(it.slug, it.qty - 1)} aria-label={t('Kurangi', 'Decrease')} disabled={it.qty <= it.moq}>−</button>
                        <input
                          type="number"
                          min={it.moq}
                          value={it.qty}
                          onChange={(e) => updateQty(it.slug, Number(e.target.value) || it.moq)}
                          aria-label={`${t('Jumlah', 'Quantity')} ${name}`}
                        />
                        <button type="button" onClick={() => updateQty(it.slug, it.qty + 1)} aria-label={t('Tambah', 'Increase')}>+</button>
                      </div>
                      <span className="cart-line-total">{formatIDR(lineTotal)}</span>
                      <button type="button" className="cart-remove" onClick={() => remove(it.slug)} aria-label={`${t('Hapus', 'Remove')} ${name}`}>
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <aside className="summary">
                <h2 className="summary-title">{t('Ringkasan', 'Summary')}</h2>
                {quote ? (
                  <>
                    <div className="summary-row">
                      <span>Subtotal ({count} {t('item', 'items')})</span>
                      <span>{formatIDR(quote.subtotal)}</span>
                    </div>
                    {quote.discountTotal > 0 && (
                      <div className="summary-row">
                        <span>{t('Diskon', 'Discount')}</span>
                        <span>−{formatIDR(quote.discountTotal)}</span>
                      </div>
                    )}
                    {quote.fees.map((fee) => (
                      <div key={fee.id} className="summary-row">
                        <span>{tr(fee.name, lang)}</span>
                        <span>{formatIDR(fee.amount)}</span>
                      </div>
                    ))}
                    <div className="summary-row summary-muted">
                      <span>{quote.priceIncludesTax ? t(`Termasuk PPN ${quote.taxRate}%`, `Includes VAT ${quote.taxRate}%`) : `PPN ${quote.taxRate}%`}</span>
                      <span>{quote.priceIncludesTax ? formatIDR(quote.taxTotal) : formatIDR(quote.taxTotal)}</span>
                    </div>
                    <div className="summary-row summary-muted">
                      <span>{t('Ongkir', 'Shipping')}</span>
                      <span>{t('Dihitung saat checkout', 'Calculated at checkout')}</span>
                    </div>
                    <div className="summary-row summary-total">
                      <span>{t('Estimasi total', 'Estimated total')}</span>
                      <span>{formatIDR(quote.grandTotal)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="summary-row">
                      <span>Subtotal ({count} {t('item', 'items')})</span>
                      <span>{formatIDR(subtotal)}</span>
                    </div>
                    <div className="summary-row summary-muted">
                      <span>{t('Ongkir & biaya', 'Shipping & fees')}</span>
                      <span>{t('Dihitung saat checkout', 'Calculated at checkout')}</span>
                    </div>
                    <div className="summary-row summary-total">
                      <span>{t('Estimasi total', 'Estimated total')}</span>
                      <span>{quoting ? '…' : formatIDR(subtotal)}</span>
                    </div>
                  </>
                )}
                {quoteError && <p className="form-error" role="alert">{quoteError}</p>}
                {!customer && authReady && (
                  <p className="form-note" style={{ marginTop: 10 }}>
                    {t('Login untuk melihat harga berlaku dan melanjutkan checkout.', 'Log in to see current pricing and continue to checkout.')}
                  </p>
                )}
                <Link href={checkoutHref} className="btn btn-solid btn-block" style={{ marginTop: 18 }}>
                  {customer ? t('Lanjut ke checkout', 'Proceed to checkout') : t('Login untuk checkout', 'Log in to checkout')} <Icon name="arrow" />
                </Link>
                <Link href="/catalog" className="link" style={{ marginTop: 16, justifyContent: 'center' }}>
                  {t('Lanjut belanja', 'Continue shopping')}
                </Link>
              </aside>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
