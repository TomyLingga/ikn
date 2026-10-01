'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, type Envelope } from '@/lib/api';
import { tr } from '@/lib/cms';
import type { PagedMeta } from '@/lib/cms';
import { orderLabel } from '@/lib/commerce';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';
import { monthToDate, openChat, shopPaths } from '@/lib/shop';
import type { IconName, OrderGroupCounts, OrderGroupKey, OrderSummary } from '@/lib/types';
import styles from './CustomerOrders.module.css';
import { confirmDialog } from '@/components/ConfirmDialog';

type TabKey = 'all' | OrderGroupKey;

interface TabDef {
  key: TabKey;
  id: string;
  en: string;
  icon: IconName;
  /** Tab pekerjaan yang masih terbuka: jumlahnya ditampilkan sebagai badge dan filter tanggal tidak berlaku. */
  open?: boolean;
}

const ALL_TAB: TabDef = { key: 'all', id: 'Semua', en: 'All', icon: 'orders' };

const TABS: TabDef[] = [
  ALL_TAB,
  { key: 'unpaid', id: 'Belum bayar', en: 'To pay', icon: 'wallet', open: true },
  { key: 'processing', id: 'Diproses', en: 'Processing', icon: 'package', open: true },
  { key: 'shipped', id: 'Dikirim', en: 'Shipped', icon: 'truck', open: true },
  { key: 'to_review', id: 'Perlu diulas', en: 'To review', icon: 'star', open: true },
  { key: 'completed', id: 'Selesai', en: 'Completed', icon: 'checkCircle' },
  { key: 'cancelled', id: 'Dibatalkan', en: 'Cancelled', icon: 'cancelCircle' },
];

const PER_PAGE = 8;
const MAX_ITEMS = 2;
const paths = shopPaths(true);

interface ListEnvelope extends Envelope<OrderSummary[]> {
  meta?: PagedMeta & { groups?: Partial<OrderGroupCounts> };
}

interface CardAction {
  label: string;
  icon: IconName;
  primary?: boolean;
  href?: string;
  onClick?: () => void;
}

// "Pesanan saya": GET /customer/orders?group&q&from&to&page. Tab mengikuti kelompok status (meta.groups memberi
// angka tiap tab); aksi cepat (terima, selesaikan, batalkan) memanggil API yang sama dengan halaman detail, lalu
// memuat ulang daftar sehingga tombol selalu mengikuti flag can* dari server.
export default function CustomerOrders() {
  const { customer } = useAuth();
  const { lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const initialTab = (params.get('tab') || 'all') as TabKey;
  const [tab, setTab] = useState<TabKey>(TABS.some((item) => item.key === initialTab) ? initialTab : 'all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  // Rentang tanggal (hanya tab Semua/Selesai/Dibatalkan) bawaan awal bulan s.d. hari ini; "Hapus filter" mengosongkannya.
  const [from, setFrom] = useState(() => monthToDate().from);
  const [to, setTo] = useState(() => monthToDate().to);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [groups, setGroups] = useState<Partial<OrderGroupCounts>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const activeTab = TABS.find((item) => item.key === tab) ?? ALL_TAB;
  const dated = !activeTab.open;
  const customerId = customer?.id;

  // Pencarian ke server setelah jeda mengetik.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
    if (tab !== 'all') qs.set('group', tab);
    if (q) qs.set('q', q);
    if (dated && from) qs.set('from', from);
    if (dated && to) qs.set('to', to);
    try {
      const res = await api<ListEnvelope>(`/customer/orders?${qs.toString()}`, { raw: true });
      setOrders(res.data || []);
      setMeta(res.meta || { page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
      setGroups(res.meta?.groups || {});
    } catch (err) {
      setOrders([]);
      setError(errorMessage(err, lang === 'en' ? 'Failed to load orders.' : 'Gagal memuat pesanan.'));
    } finally {
      setLoading(false);
    }
  }, [customerId, page, tab, q, from, to, dated, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function changeTab(next: TabKey) {
    setTab(next);
    setPage(1);
    router.replace(next === 'all' ? '/dashboard/pesanan' : `/dashboard/pesanan?tab=${next}`, { scroll: false });
  }

  async function quickAction(order: OrderSummary, suffix: string, confirmText: string, okText: string) {
    if (busy || !await confirmDialog(confirmText)) return;
    setBusy(order.number);
    setError('');
    try {
      await api(`/customer/orders/${encodeURIComponent(order.number)}${suffix}`, { method: 'POST' });
      setNotice(okText);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  function actionsFor(order: OrderSummary): CardAction[] {
    const detail = paths.order(order.number);
    const first = order.items[0];
    const again: CardAction = { label: t('Beli lagi', 'Buy again'), icon: 'bag', href: first ? paths.product(first.productSlug) : paths.catalog };
    const list: CardAction[] = [];

    switch (order.status) {
      case 'pending_payment':
        list.push({ label: order.canUploadProof === false ? t('Lihat pembayaran', 'View payment') : t('Bayar sekarang', 'Pay now'), icon: 'wallet', primary: true, href: `${detail}#payment` });
        if (order.canCancel) {
          list.push({
            label: t('Batalkan', 'Cancel'),
            icon: 'close',
            onClick: () => void quickAction(order, '/cancel', t(`Batalkan pesanan ${order.number}?`, `Cancel order ${order.number}?`), t('Pesanan dibatalkan.', 'Order cancelled.')),
          });
        }
        break;
      case 'payment_review':
        list.push({ label: t('Lihat pembayaran', 'View payment'), icon: 'shieldCheck', href: `${detail}#payment` });
        break;
      case 'paid':
      case 'processing':
        list.push({ label: t('Lacak pesanan', 'Track order'), icon: 'package', href: `${detail}#tracking` });
        break;
      case 'shipped':
        if (order.canConfirmReceived) {
          list.push({
            label: t('Pesanan diterima', 'Order received'),
            icon: 'check',
            primary: true,
            onClick: () =>
              void quickAction(
                order,
                '/confirm-received',
                t(`Konfirmasi bahwa pesanan ${order.number} sudah Anda terima?`, `Confirm that you have received order ${order.number}?`),
                t('Terima kasih, pesanan ditandai diterima.', 'Thank you, the order is marked as received.'),
              ),
          });
        }
        list.push({ label: t('Lacak', 'Track'), icon: 'truck', href: `${detail}#tracking` });
        break;
      case 'delivered':
        if (order.canComplete) {
          list.push({
            label: t('Selesaikan pesanan', 'Complete order'),
            icon: 'checkCircle',
            primary: true,
            onClick: () =>
              void quickAction(
                order,
                '/complete',
                t(`Selesaikan pesanan ${order.number}? Setelah selesai Anda bisa memberi ulasan.`, `Complete order ${order.number}? You can leave a review afterwards.`),
                t('Pesanan selesai. Bagikan ulasan Anda.', 'Order completed. Share your review.'),
              ),
          });
        }
        break;
      case 'completed':
        if (order.canReview) list.push({ label: t('Beri ulasan', 'Write a review'), icon: 'star', primary: true, href: `${detail}#review` });
        list.push(again);
        break;
      default:
        list.push(again);
    }

    return list;
  }

  if (!customer) return null;

  const defaults = monthToDate();
  const hasFilter = !!q || (dated && (from !== defaults.from || to !== defaults.to));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>{t('Pesanan saya', 'My orders')}</h1>
          <p>
            {t('Pesanan', 'Orders of')} {(customer.company || customer.name).replace(/\.+$/, '')}: {t('bayar, lacak, dan beri ulasan dari sini.', 'pay, track, and review from here.')}
          </p>
        </div>
        <Link href={paths.catalog} className={styles.shopLink}>
          <Icon name="store" size={17} /> {t('Belanja lagi', 'Shop again')}
        </Link>
      </header>

      <div className={styles.tabs} role="tablist" aria-label={t('Kelompok status pesanan', 'Order status groups')}>
        {TABS.map((item) => {
          const count = item.key === 'all' ? 0 : groups[item.key] || 0;
          const selected = item.key === tab;
          return (
            <button key={item.key} type="button" role="tab" aria-selected={selected} className={`${styles.tab} ${selected ? styles.tabOn : ''}`} onClick={() => changeTab(item.key)}>
              <Icon name={item.icon} size={17} />
              <span>{item[lang]}</span>
              {item.open && count > 0 && <em className={styles.tabCount}>{count > 99 ? '99+' : count}</em>}
            </button>
          );
        })}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Cari nomor pesanan atau nama produk', 'Search order number or product name')}
            aria-label={t('Cari pesanan', 'Search orders')}
          />
        </label>
        {dated ? (
          <>
            <label className={styles.dateField}>
              <span>{t('Dari', 'From')}</span>
              <input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
            </label>
            <label className={styles.dateField}>
              <span>{t('Sampai', 'To')}</span>
              <input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
            </label>
            {(from || to) && (
              <button type="button" className={styles.reset} onClick={() => { setFrom(''); setTo(''); setPage(1); }}>
                {t('Semua tanggal', 'All dates')}
              </button>
            )}
          </>
        ) : (
          <span className={styles.openNote}>
            <Icon name="clock" size={15} /> {t('Menampilkan semua pesanan yang masih terbuka, tanpa filter tanggal.', 'Showing every open order, regardless of date.')}
          </span>
        )}
        {hasFilter && (
          <button type="button" className={styles.reset} onClick={() => { setSearch(''); setQ(''); setFrom(defaults.from); setTo(defaults.to); setPage(1); }}>
            {t('Reset filter', 'Reset filters')}
          </button>
        )}
      </div>

      {notice && (
        <p className={styles.notice} role="status">
          <Icon name="check" size={16} /> {notice}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading && orders.length === 0 ? (
        <div className={styles.skeletons} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon name={activeTab.icon} size={30} strokeWidth={1.3} />
          </span>
          <h2>{hasFilter ? t('Tidak ada pesanan yang cocok', 'No matching orders') : t('Belum ada pesanan di sini', 'No orders here yet')}</h2>
          <p>
            {hasFilter
              ? t('Coba kata kunci atau rentang tanggal lain.', 'Try another keyword or date range.')
              : tab === 'to_review'
                ? t('Pesanan yang sudah selesai dan belum diulas akan muncul di sini.', 'Completed orders that still need a review will show up here.')
                : t('Pesanan Anda pada kelompok ini akan muncul di sini.', 'Your orders in this group will show up here.')}
          </p>
          <Link href={paths.catalog} className={styles.primaryBtn}>
            <Icon name="store" size={17} /> {t('Belanja produk', 'Shop products')}
          </Link>
        </div>
      ) : (
        <div className={styles.list} aria-busy={loading}>
          {orders.map((order) => {
            const status = orderLabel(order.status);
            const detail = paths.order(order.number);
            const shown = order.items.slice(0, MAX_ITEMS);
            const rest = order.items.length - shown.length;
            const actions = actionsFor(order);

            return (
              <article key={order.number} className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.cardId}>
                    <Link href={detail} className={styles.number}>
                      {order.number}
                    </Link>
                    <span>{formatDate(order.date, lang)}</span>
                  </div>
                  <StatusBadge label={status[lang]} tone={status.tone} />
                </div>

                {order.status === 'pending_payment' && order.paymentDueAt && (
                  <p className={`${styles.strip} ${styles.stripWarn}`}>
                    <Icon name="clock" size={15} /> {t('Bayar sebelum', 'Pay before')} <strong>{formatDateTime(order.paymentDueAt, lang)}</strong>
                  </p>
                )}
                {(order.status === 'shipped' || order.status === 'delivered') && order.trackingNumber && (
                  <p className={styles.strip}>
                    <Icon name="truck" size={15} /> {order.courier ? `${order.courier} · ` : ''}
                    {t('Resi', 'Tracking no.')} <strong className="mono">{order.trackingNumber}</strong>
                  </p>
                )}

                <Link href={detail} className={styles.items} aria-label={`${t('Lihat detail pesanan', 'View order details')} ${order.number}`}>
                  {shown.map((item) => (
                    <span key={`${order.number}-${item.productSlug}`} className={styles.item}>
                      <span className={styles.thumb}>
                        {item.image ? <Image src={item.image} alt="" width={64} height={64} /> : <Icon name="package" size={26} strokeWidth={1.4} />}
                      </span>
                      <span className={styles.itemBody}>
                        <strong>{tr(item.name, lang)}</strong>
                        <small>{item.code || ''}</small>
                      </span>
                      <span className={styles.itemQty}>
                        {item.qty} {item.unit || ''} × {formatIDR(item.unitPrice)}
                      </span>
                    </span>
                  ))}
                  {rest > 0 && (
                    <span className={styles.moreItems}>
                      +{rest} {t('produk lainnya', 'more products')}
                    </span>
                  )}
                </Link>

                <div className={styles.cardFoot}>
                  <div className={styles.total}>
                    <span>
                      {order.itemsCount} {t('produk', order.itemsCount === 1 ? 'product' : 'products')} · {t('Total pesanan', 'Order total')}
                    </span>
                    <strong>{formatIDR(order.grandTotal)}</strong>
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={styles.ghostBtn} onClick={() => openChat({ type: 'order', number: order.number, label: order.number })}>
                      <Icon name="chat" size={16} /> {t('Tanya penjual', 'Ask seller')}
                    </button>
                    <Link href={detail} className={styles.lineBtn}>
                      {t('Detail', 'Details')}
                    </Link>
                    {actions.map((action) =>
                      action.href ? (
                        <Link key={action.label} href={action.href} className={action.primary ? styles.primaryBtn : styles.lineBtn}>
                          <Icon name={action.icon} size={16} /> {action.label}
                        </Link>
                      ) : (
                        <button key={action.label} type="button" className={action.primary ? styles.primaryBtn : styles.lineBtn} onClick={action.onClick} disabled={busy === order.number}>
                          <Icon name={action.icon} size={16} /> {action.label}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {meta.lastPage > 1 && (
        <nav className={styles.pager} aria-label={t('Navigasi halaman', 'Pagination')}>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} aria-label={t('Halaman sebelumnya', 'Previous page')}>
            <Icon name="chevronLeft" size={16} />
          </button>
          <span>
            {t('Halaman', 'Page')} {meta.page} / {meta.lastPage} · {meta.total} {t('pesanan', 'orders')}
          </span>
          <button type="button" onClick={() => setPage((value) => Math.min(meta.lastPage, value + 1))} disabled={page >= meta.lastPage || loading} aria-label={t('Halaman berikutnya', 'Next page')}>
            <Icon name="chevronRight" size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
