'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/components/CartProvider';
import { useLang } from '@/components/LanguageProvider';
import Icon from '@/components/Icon';
import { tr } from '@/lib/cms';
import { formatIDR } from '@/lib/format';
import { CART_OPEN_EVENT, shopPaths } from '@/lib/shop';
import styles from './CustomerCart.module.css';

const paths = shopPaths(true);

// Laci keranjang di topbar portal customer. Tautan produk dan checkout tetap di dalam portal.
export default function CustomerCart() {
  const [isOpen, setIsOpen] = useState(false);
  const { items, count, subtotal, remove, updateQty, ready } = useCart();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  // Komponen lain (mis. tombol "Lihat keranjang" di detail produk) membuka laci lewat openCartDrawer().
  useEffect(() => {
    const onOpen = () => setIsOpen(true);
    window.addEventListener(CART_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CART_OPEN_EVENT, onOpen);
  }, []);

  if (!ready) return null;

  return (
    <>
      <button
        type="button"
        className={styles.cartBtn}
        onClick={() => setIsOpen(true)}
        aria-label={`${t('Keranjang', 'Cart')} (${count} item)`}
      >
        <Icon name="bag" size={20} />
        {count > 0 && <span className={styles.badge}>{count > 9 ? '9+' : count}</span>}
      </button>

      {isOpen && createPortal(
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-cart-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 id="customer-cart-title" className="h3">{t('Keranjang Anda', 'Your cart')}</h2>
              <button type="button" onClick={() => setIsOpen(false)} className={styles.closeBtn} aria-label={t('Tutup keranjang', 'Close cart')}>
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className={styles.body}>
              {items.length === 0 ? (
                <div className={styles.empty}>
                  <Icon name="bag" size={48} strokeWidth={1} />
                  <p>{t('Keranjang Anda kosong.', 'Your cart is empty.')}</p>
                  <Link href="/dashboard/katalog" onClick={() => setIsOpen(false)} className="btn btn-line">{t('Belanja sekarang', 'Shop now')}</Link>
                </div>
              ) : (
                <div className={styles.list}>
                  {items.map((item) => {
                    const name = tr(item.name, lang);
                    return (
                      <div key={item.slug} className={styles.item}>
                        <div className={styles.thumb}>
                          {item.image ? (
                            <Image src={item.image} alt={name} fill sizes="60px" />
                          ) : (
                            <Icon name="image" size={24} />
                          )}
                        </div>
                        <div className={styles.info}>
                          <Link href={paths.product(item.slug)} className={styles.name} onClick={() => setIsOpen(false)}>
                            {name}
                          </Link>
                          <div className={styles.price}>{formatIDR(item.unitPrice || 0)}/{item.unit}</div>
                          <div className={styles.actions}>
                            <div className={styles.qtyCtl}>
                              <button type="button" onClick={() => updateQty(item.slug, item.qty - 1)} disabled={item.qty <= item.moq} aria-label={t('Kurangi', 'Decrease')}>-</button>
                              <input type="number" readOnly value={item.qty} aria-label={t('Jumlah', 'Quantity')} />
                              <button type="button" onClick={() => updateQty(item.slug, item.qty + 1)} aria-label={t('Tambah', 'Increase')}>+</button>
                            </div>
                            <button type="button" onClick={() => remove(item.slug)} className={styles.removeBtn} aria-label={`${t('Hapus', 'Remove')} ${name}`}>
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className={styles.footer}>
                <div className={styles.subtotal}>
                  <span>{t('Estimasi subtotal', 'Estimated subtotal')}</span>
                  <strong>{formatIDR(subtotal)}</strong>
                </div>
                <Link href={paths.checkout} className="btn btn-solid btn-full" onClick={() => setIsOpen(false)}>
                  {t('Checkout', 'Checkout')} <Icon name="arrow" />
                </Link>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
