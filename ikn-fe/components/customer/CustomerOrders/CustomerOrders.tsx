'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { apiPaged, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import type { PagedMeta } from '@/lib/cms';
import { orderLabel, orderStatus, paymentLabel } from '@/lib/commerce';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';
import type { IconName, OrderStatusKey, OrderSummary } from '@/lib/types';
import styles from './CustomerOrders.module.css';

interface OrderCardAction {
  label: string;
  href: string;
  icon: IconName;
  primary?: boolean;
}

const PER_PAGE = 10;

// Daftar pesanan: GET /customer/orders?status&page&perPage (OrderSummaryResource — tanpa flag can*,
// sehingga tombol aksi diturunkan dari status dan keputusan final tetap di halaman detail).
export default function CustomerOrders() {
  const { customer } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [status, setStatus] = useState<OrderStatusKey | ''>('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!customer) return;
    let active = true;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
    if (status) qs.set('status', status);
    apiPaged<OrderSummary>(`/customer/orders?${qs.toString()}`)
      .then((res) => {
        if (!active) return;
        setOrders(res.items);
        setMeta(res.meta);
      })
      .catch((err) => {
        if (!active) return;
        setOrders([]);
        setError(errorMessage(err, t('Gagal memuat pesanan.', 'Failed to load orders.')));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, status, page]);

  function getOrderAction(order: OrderSummary): OrderCardAction {
    const detailHref = `/dashboard/pesanan/${order.number}`;
    const firstProductHref = order.items[0] ? `/catalog/${order.items[0].productSlug}` : '/dashboard/katalog';
    switch (order.status) {
      case 'pending_payment':
        return { label: t('Bayar sekarang', 'Pay now'), href: `${detailHref}#payment`, icon: 'wallet', primary: true };
      case 'payment_review':
        return { label: t('Lihat pembayaran', 'View payment'), href: `${detailHref}#payment`, icon: 'shieldCheck' };
      case 'paid':
      case 'processing':
        return { label: t('Lacak pesanan', 'Track order'), href: `${detailHref}#tracking`, icon: 'package' };
      case 'shipped':
        return { label: t('Konfirmasi diterima', 'Confirm received'), href: `${detailHref}#tracking`, icon: 'truck', primary: true };
      case 'delivered':
        return { label: t('Lihat pesanan', 'View order'), href: `${detailHref}#tracking`, icon: 'checkCircle' };
      case 'completed':
        return { label: t('Beri ulasan', 'Write a review'), href: `${detailHref}#review`, icon: 'check', primary: true };
      case 'cancelled':
      case 'expired':
        return { label: t('Pesan lagi', 'Order again'), href: firstProductHref, icon: 'bag' };
      default:
        return { label: t('Lihat detail', 'View details'), href: detailHref, icon: 'arrow' };
    }
  }

  if (!customer) return null;

  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? orders.filter((o) => o.number.toLowerCase().includes(normalized) || o.items.some((i) => tr(i.name, lang).toLowerCase().includes(normalized)))
    : orders;

  return (
    <div>
      <div className="acct-section-head">
        <div>
          <h2 className={styles.heading}>{t('Pesanan saya', 'My orders')}</h2>
          <p className={styles.intro}>{t('Hanya pesanan milik', 'Only orders from')} {customer.company || customer.name} {t('yang ditampilkan.', 'are shown.')}</p>
        </div>
        <span className={styles.orderCount}>{meta.total} {t('pesanan', 'orders')}</span>
      </div>

      <div className="orders-toolbar">
        <label className={`cat-search ${styles.search}`}>
          <Icon name="compass" size={20} strokeWidth={1.8} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Cari nomor atau nama produk di halaman ini', 'Search order number or product on this page')} aria-label={t('Cari pesanan', 'Search orders')} />
        </label>
        <select
          className="cat-sort"
          value={status}
          onChange={(e) => { setStatus(e.target.value as OrderStatusKey | ''); setPage(1); }}
          aria-label={t('Filter status', 'Status filter')}
        >
          <option value="">{t('Semua status', 'All statuses')}</option>
          {(Object.keys(orderStatus) as OrderStatusKey[]).map((key) => (
            <option key={key} value={key}>{orderStatus[key][lang]}</option>
          ))}
        </select>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="form-note">{t('Memuat pesanan…', 'Loading orders…')}</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('Pesanan tidak ditemukan', 'No orders found')}
          body={t('Belum ada pesanan untuk filter ini. Mulai pesanan baru dari katalog.', 'No orders match this filter. Start a new order from the catalog.')}
          action={{ href: '/dashboard/katalog', label: t('Lihat katalog', 'View catalog') }}
        />
      ) : (
        <div className="acct-order-list">
          {visible.map((order) => {
            const st = orderLabel(order.status);
            const pay = paymentLabel(order.paymentStatus);
            const detailHref = `/dashboard/pesanan/${order.number}`;
            const action = getOrderAction(order);

            return (
              <article key={order.number} className={`acct-order-card ${styles.orderCard}`}>
                <div className={styles.orderHeader}>
                  <div>
                    <Link href={detailHref} className={styles.orderNumber}>{order.number}</Link>
                    <span className={styles.orderDate}>
                      {formatDate(order.date, lang)}
                      {order.status === 'pending_payment' && order.paymentDueAt && (
                        <> · {t('bayar sebelum', 'pay before')} {formatDateTime(order.paymentDueAt, lang)}</>
                      )}
                      {order.trackingNumber && <> · {order.courier ? `${order.courier} ` : ''}{order.trackingNumber}</>}
                    </span>
                  </div>
                  <div className={styles.badges}>
                    <StatusBadge label={st[lang]} tone={st.tone} />
                    <StatusBadge label={pay[lang]} tone={pay.tone} />
                  </div>
                </div>

                <div className={styles.orderContent}>
                  <div className={styles.productList}>
                    {order.items.map((item) => (
                      <div key={`${order.number}-${item.productSlug}`} className={styles.productItem}>
                        <span className={styles.productImage}>
                          <Icon name="package" size={28} strokeWidth={1.6} />
                        </span>
                        <span className={styles.productInfo}>
                          <strong>{tr(item.name, lang)}</strong>
                          <span>{item.code ? `${item.code} · ` : ''}{item.qty} {item.unit || ''}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <span className={styles.totalBlock}>
                    <span>{t('Total pesanan', 'Order total')}</span>
                    <strong>{formatIDR(order.grandTotal)}</strong>
                  </span>
                </div>

                <div className={styles.cardFooter}>
                  <Link href={detailHref} className={styles.more}>
                    {t('Lihat detail pesanan', 'View order details')} <Icon name="arrow" size={18} strokeWidth={1.8} />
                  </Link>
                  <Link
                    href={action.href}
                    className={`${styles.actionButton} ${action.primary ? styles.actionPrimary : styles.actionSecondary}`}
                    aria-label={`${action.label} — ${order.number}`}
                  >
                    <Icon name={action.icon} size={19} strokeWidth={1.8} /> {action.label}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {meta.lastPage > 1 && (
        <nav className="cat-pagination" aria-label={t('Navigasi halaman', 'Pagination')}>
          <button type="button" className="btn btn-line btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="cat-count">{t('Halaman', 'Page')} {meta.page} / {meta.lastPage}</span>
          <button type="button" className="btn btn-line btn-sm" onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))} disabled={page >= meta.lastPage}>
            <Icon name="chevronRight" size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
