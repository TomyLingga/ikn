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
import { formatDate, formatIDR } from '@/lib/format';
import { isoDay, monthToDate, openChat, shopPaths } from '@/lib/shop';
import OrderProgress, { orderNextStep } from '@/components/customer/OrderProgress';
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

type Preset = 'month' | '30d' | 'year';

// Same presets as the customer dashboard range bar.
function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  if (preset === '30d') return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: isoDay(now) };
  if (preset === 'year') return { from: isoDay(new Date(now.getFullYear(), 0, 1)), to: isoDay(now) };
  return monthToDate();
}

/** Empty-state copy + call to action per tab. */
function emptyCopy(tab: TabKey, t: (id: string, en: string) => string): { title: string; body: string } {
  switch (tab) {
    case 'unpaid':
      return { title: t('Tidak ada tagihan tertunda', 'No pending payments'), body: t('Semua pesanan sudah dibayar. Pesanan baru yang menunggu pembayaran akan muncul di sini.', 'Every order is paid. New orders awaiting payment will show up here.') };
    case 'processing':
      return { title: t('Tidak ada pesanan yang diproses', 'Nothing being processed'), body: t('Setelah pembayaran diverifikasi, pesanan yang sedang disiapkan tampil di sini.', 'Once a payment is verified, orders being prepared show up here.') };
    case 'shipped':
      return { title: t('Tidak ada kiriman berjalan', 'No shipments on the way'), body: t('Pesanan yang sedang dalam perjalanan beserta nomor resinya akan muncul di sini.', 'Orders in transit, with their tracking numbers, will show up here.') };
    case 'to_review':
      return { title: t('Semua pesanan sudah diulas', 'All orders reviewed'), body: t('Pesanan yang sudah selesai dan belum diulas akan muncul di sini.', 'Completed orders that still need a review will show up here.') };
    case 'completed':
      return { title: t('Belum ada pesanan selesai', 'No completed orders'), body: t('Pesanan selesai pada rentang tanggal ini akan muncul di sini.', 'Orders completed within this date range will show up here.') };
    case 'cancelled':
      return { title: t('Tidak ada pesanan dibatalkan', 'No cancelled orders'), body: t('Bagus! Tidak ada pesanan yang dibatalkan atau kedaluwarsa pada rentang ini.', 'Good news: no cancelled or expired orders in this range.') };
    default:
      return { title: t('Belum ada pesanan', 'No orders yet'), body: t('Mulai belanja produk karet industri PT IKN; pesanan Anda akan tercatat di sini.', 'Start shopping PT IKN industrial rubber products; your orders will be listed here.') };
  }
}

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
  const activePreset = (['month', '30d', 'year'] as Preset[]).find((key) => {
    const r = presetRange(key);
    return r.from === from && r.to === to;
  });
  const unpaidCount = groups.unpaid || 0;
  const reviewCount = groups.to_review || 0;
  const empty = emptyCopy(tab, t);
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

      {tab === 'all' && (unpaidCount > 0 || reviewCount > 0) && (
        <div className={styles.attention}>
          {unpaidCount > 0 && (
            <button type="button" className={`${styles.attnItem} ${styles.attnWarn}`} onClick={() => changeTab('unpaid')}>
              <span className={styles.attnIcon}><Icon name="wallet" size={18} /></span>
              <span>
                <strong>{unpaidCount} {t('pesanan menunggu pembayaran', unpaidCount === 1 ? 'order awaiting payment' : 'orders awaiting payment')}</strong>
                <small>{t('Bayar sebelum batas waktu agar stok tetap dipesan untuk Anda.', 'Pay before the deadline to keep the stock reserved.')}</small>
              </span>
              <Icon name="chevronRight" size={18} />
            </button>
          )}
          {reviewCount > 0 && (
            <button type="button" className={styles.attnItem} onClick={() => changeTab('to_review')}>
              <span className={styles.attnIcon}><Icon name="star" size={18} /></span>
              <span>
                <strong>{reviewCount} {t('pesanan menunggu ulasan', reviewCount === 1 ? 'order to review' : 'orders to review')}</strong>
                <small>{t('Bagikan pengalaman Anda dengan produk kami.', 'Share your experience with our products.')}</small>
              </span>
              <Icon name="chevronRight" size={18} />
            </button>
          )}
        </div>
      )}

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
          <div className={styles.rangeBar}>
            <div className={styles.presets} role="group" aria-label={t('Periode', 'Period')}>
              {(
                [
                  ['month', t('Bulan ini', 'This month')],
                  ['30d', t('30 hari', '30 days')],
                  ['year', t('Tahun ini', 'This year')],
                ] as [Preset, string][]
              ).map(([key, label]) => (
                <button key={key} type="button" className={activePreset === key ? styles.presetOn : ''} aria-pressed={activePreset === key} onClick={() => { const r = presetRange(key); setFrom(r.from); setTo(r.to); setPage(1); }}>
                  {label}
                </button>
              ))}
              <button type="button" className={!from && !to ? styles.presetOn : ''} aria-pressed={!from && !to} onClick={() => { setFrom(''); setTo(''); setPage(1); }}>
                {t('Semua tanggal', 'All dates')}
              </button>
            </div>
            <label className={styles.dateField}>
              <span>{t('Dari', 'From')}</span>
              <input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
            </label>
            <label className={styles.dateField}>
              <span>{t('Sampai', 'To')}</span>
              <input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
            </label>
          </div>
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
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skelCard}>
              <span className={styles.skelLine} style={{ width: '38%' }} />
              <span className={styles.skelLine} style={{ width: '100%', height: 26 }} />
              <div className={styles.skelRow}>
                <span className={styles.skelThumb} />
                <span className={styles.skelLine} style={{ width: '52%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon name={activeTab.icon} size={30} strokeWidth={1.3} />
          </span>
          <h2>{hasFilter ? t('Tidak ada pesanan yang cocok', 'No matching orders') : empty.title}</h2>
          <p>{hasFilter ? t('Coba kata kunci lain, atau tampilkan semua tanggal.', 'Try another keyword, or show all dates.') : empty.body}</p>
          <div className={styles.emptyActions}>
            {hasFilter || (dated && (from || to)) ? (
              <button type="button" className={styles.lineBtn} onClick={() => { setSearch(''); setQ(''); setFrom(''); setTo(''); setPage(1); }}>
                <Icon name="clock" size={16} /> {t('Tampilkan semua tanggal', 'Show all dates')}
              </button>
            ) : tab !== 'all' ? (
              <button type="button" className={styles.lineBtn} onClick={() => changeTab('all')}>
                <Icon name="orders" size={16} /> {t('Lihat semua pesanan', 'View all orders')}
              </button>
            ) : null}
            <Link href={paths.catalog} className={styles.primaryBtn}>
              <Icon name="store" size={17} /> {t('Belanja produk', 'Shop products')}
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.list} aria-busy={loading}>
          {orders.map((order) => {
            const status = orderLabel(order.status);
            const detail = paths.order(order.number);
            const shown = order.items.slice(0, MAX_ITEMS);
            const rest = order.items.length - shown.length;
            const actions = actionsFor(order);
            const next = orderNextStep(order, lang);

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

                <div className={styles.progress}>
                  <p className={`${styles.next} ${styles[`next_${next.tone}`]}`}>
                    <span className={styles.nextIcon}>
                      <Icon name={next.icon} size={17} />
                    </span>
                    <span>
                      <strong>{next.title}</strong>
                      <small>{next.body}</small>
                    </span>
                  </p>
                  <div className={styles.stepper}>
                    <OrderProgress status={order.status} lang={lang} compact />
                  </div>
                </div>
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
                        <small>
                          {item.qty.toLocaleString('id-ID')} {item.unit || ''} × {formatIDR(item.unitPrice)}
                        </small>
                        <strong>{formatIDR(item.lineTotal)}</strong>
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
