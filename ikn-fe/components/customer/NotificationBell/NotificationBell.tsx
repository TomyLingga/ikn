'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import { dismissToasts, toast, type ToastTone } from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, type Envelope } from '@/lib/api';
import { refreshAdminBadges } from '@/lib/admin';
import { tr } from '@/lib/cms';
import { refreshCustomerBadges, timeAgo } from '@/lib/shop';
import type { IconName, UserNotification } from '@/lib/types';
import styles from './NotificationBell.module.css';

const PER_PAGE = 12;
// Paling banyak sekian notifikasi baru yang dijadikan toast dalam satu kali polling.
const TOAST_FETCH = 5;

interface ListEnvelope extends Envelope<UserNotification[]> {
  meta?: Envelope['meta'] & { unread?: number };
}

// Id notifikasi terbaru yang sudah diketahui tab ini; disimpan per tab agar muat ulang tidak memutar ulang toast lama.
function readSeen(key: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeSeen(key: string, id: number): void {
  try {
    window.sessionStorage.setItem(key, String(id));
  } catch {
    // Penyimpanan diblokir: patokan tetap ada di memori selama halaman terbuka.
  }
}

// Nada toast dari akhiran jenis notifikasi (order.cancelled, admin.freight_expired, account.approved, ...).
function toneFor(type: string): ToastTone {
  if (/(cancelled|expired|rejected)$/.test(type)) return 'danger';
  if (/(accepted|completed|approved|delivered|received|picked_up)$/.test(type)) return 'success';
  if (type === 'order.payment_reminder') return 'warning';
  return 'info';
}

// Ikon per jenis notifikasi (awalan `type` dari API).
function iconFor(type: string): IconName {
  // Lonceng panel admin (kunci admin.*).
  if (type === 'admin.payment_proof') return 'wallet';
  if (type.startsWith('admin.freight')) return 'globe';
  if (type === 'admin.order_cancelled') return 'cancelCircle';
  if (type === 'admin.order_received') return 'package';
  if (type === 'admin.order_completed') return 'checkCircle';
  if (type === 'admin.customer_registered') return 'users';
  if (type.startsWith('admin.')) return 'orders';
  if (type.startsWith('order.payment')) return 'wallet';
  if (type === 'order.shipped' || type === 'order.tracking') return 'truck';
  // Order FOB/CIF (ASUMSI A-88): dimuat ke kapal dan revisi proforma invoice.
  if (type === 'order.shipped_on_board') return 'globe';
  // Penawaran ongkir CIF (ASUMSI A-89): freight_requested/quoted/quote_extended/accepted/expired/cancelled.
  if (type.startsWith('order.freight')) return 'globe';
  if (type === 'order.proforma_updated') return 'orders';
  if (type === 'order.delivered' || type === 'order.delivered_balance_due') return 'package';
  if (type === 'order.completed') return 'checkCircle';
  if (type === 'order.cancelled' || type === 'order.expired') return 'cancelCircle';
  if (type.startsWith('order.')) return 'orders';
  if (type.startsWith('voucher.')) return 'tag';
  if (type.startsWith('account.')) return 'shieldCheck';
  return 'bell';
}

interface NotificationBellProps {
  /** Jumlah belum dibaca dari GET /{area}/badges (dipolling CustomerShell / AdminShell). */
  unread: number;
  /** Portal customer (bawaan) atau panel admin: menentukan endpoint /{area}/notifications* dan badge yang disegarkan. */
  area?: 'customer' | 'admin';
}

// Lonceng notifikasi top bar portal customer (ASUMSI A-71) dan panel admin: daftar dimuat saat panel dibuka;
// klik notifikasi menandainya dibaca lalu membuka halaman terkait. Notifikasi yang baru masuk selagi halaman
// terbuka juga ditampilkan sebagai toast.
export default function NotificationBell({ unread, area = 'customer' }: NotificationBellProps) {
  const router = useRouter();
  const { lang } = useLang();
  const { user } = useAuth();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const base = `/${area}`;
  const refreshBadges = area === 'admin' ? refreshAdminBadges : refreshCustomerBadges;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrap = useRef<HTMLDivElement>(null);

  // ---- Toast untuk notifikasi baru ----
  // `seen` = id terbaru yang sudah diketahui tab ini (null = belum ada patokan). Kunjungan pertama hanya
  // memasang patokan; setelah itu notifikasi belum dibaca ber-id lebih besar dijadikan toast.
  const seenKey = user ? `ikn-notif-seen:${area}:${user.id}` : null;
  const seen = useRef<number | null>(null);
  const prevUnread = useRef(0);
  const langRef = useRef(lang);
  langRef.current = lang;
  const openRef = useRef(open);
  openRef.current = open;

  const announce = useCallback(async () => {
    if (!seenKey) return;
    try {
      const res = await api<ListEnvelope>(`${base}/notifications?unread=1&perPage=${TOAST_FETCH}`, { raw: true });
      const rows = res.data || [];
      // Dibaca setelah respons tiba: dua permintaan yang berdekatan tidak menampilkan toast yang sama dua kali.
      const known = seen.current;
      const newest = rows.reduce((max, row) => Math.max(max, row.id), known ?? 0);
      seen.current = newest;
      writeSeen(seenKey, newest);
      // Panel terbuka memuat ulang daftarnya sendiri; toast di atasnya hanya menutupi.
      if (known === null || openRef.current) return;
      for (const row of rows.filter((item) => item.id > known).reverse()) {
        toast({
          title: tr(row.title, langRef.current),
          body: tr(row.body, langRef.current),
          href: row.url || undefined,
          icon: iconFor(row.type),
          tone: toneFor(row.type),
          onClick: () => {
            api(`${base}/notifications/${row.id}/read`, { method: 'POST' })
              .catch(() => undefined)
              .finally(refreshBadges);
          },
        });
      }
    } catch {
      // Toast bukan fitur kritis: dicoba lagi pada polling berikutnya.
    }
  }, [seenKey, base, refreshBadges]);

  // Saat masuk (atau muat ulang): pasang patokan, atau tampilkan yang tiba selagi halaman dimuat ulang.
  useEffect(() => {
    if (!seenKey) return;
    seen.current = readSeen(seenKey);
    void announce();
  }, [seenKey, announce]);

  // Polling badge menaikkan jumlah belum dibaca = ada notifikasi baru.
  useEffect(() => {
    const before = prevUnread.current;
    prevUnread.current = unread;
    if (unread > before) void announce();
  }, [unread, announce]);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api<ListEnvelope>(`${base}/notifications?page=${nextPage}&perPage=${PER_PAGE}`, { raw: true });
      const rows = res.data || [];
      setItems((prev) => (nextPage === 1 ? rows : [...prev, ...rows.filter((row) => !prev.some((p) => p.id === row.id))]));
      setPage(nextPage);
      setLastPage(res.meta?.lastPage ?? 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [base]);

  // Muat ulang setiap panel dibuka, dan ketika ada notifikasi baru selagi panel terbuka.
  useEffect(() => {
    if (open) void load(1);
  }, [open, unread, load]);

  useEffect(() => {
    if (!open) return;
    // Daftar di panel sudah memuat semuanya: toast yang masih tampil ditutup agar tidak menutupi panel.
    dismissToasts();
    const onDown = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function openItem(item: UserNotification) {
    setOpen(false);
    if (!item.read) {
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
      try {
        await api(`${base}/notifications/${item.id}/read`, { method: 'POST' });
      } catch {
        // Gagal menandai dibaca tidak menghalangi navigasi; badge akan sinkron pada polling berikutnya.
      }
      refreshBadges();
    }
    if (item.url) router.push(item.url);
  }

  async function readAll() {
    setItems((prev) => prev.map((row) => ({ ...row, read: true })));
    try {
      await api(`${base}/notifications/read-all`, { method: 'POST' });
    } catch (err) {
      setError(errorMessage(err));
    }
    refreshBadges();
  }

  const emptyText =
    area === 'admin'
      ? t('Belum ada notifikasi. Pesanan baru, bukti bayar, dan pendaftaran customer akan muncul di sini.', 'No notifications yet. New orders, payment proofs, and customer registrations will show up here.')
      : t('Belum ada notifikasi. Kabar terbaru tentang pesanan dan akun Anda akan muncul di sini.', 'No notifications yet. Updates on your orders and account will show up here.');

  const label = unread > 0 ? t(`Notifikasi, ${unread} belum dibaca`, `Notifications, ${unread} unread`) : t('Notifikasi', 'Notifications');

  return (
    <div className={styles.wrap} ref={wrap}>
      <button type="button" className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Icon name="bell" size={21} strokeWidth={2} />
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label={t('Notifikasi', 'Notifications')}>
          <div className={styles.head}>
            <strong>{t('Notifikasi', 'Notifications')}</strong>
            <button type="button" className={styles.readAll} onClick={() => void readAll()} disabled={!items.some((item) => !item.read)}>
              {t('Tandai semua dibaca', 'Mark all as read')}
            </button>
          </div>

          <div className={styles.list}>
            {error && <p className={styles.note} role="alert">{error}</p>}
            {!error && items.length === 0 && (
              <div className={styles.empty}>
                <Icon name="bell" size={30} strokeWidth={1.3} />
                <p>{loading ? <Spinner label={t('Memuat notifikasi…', 'Loading notifications…')} /> : emptyText}</p>
              </div>
            )}
            {items.map((item) => (
              <button key={item.id} type="button" className={`${styles.item} ${item.read ? '' : styles.unread}`} onClick={() => void openItem(item)}>
                <span className={styles.itemIcon}>
                  <Icon name={iconFor(item.type)} size={18} />
                </span>
                <span className={styles.itemBody}>
                  <strong>{tr(item.title, lang)}</strong>
                  <span>{tr(item.body, lang)}</span>
                  <small>{timeAgo(item.createdAt, lang)}</small>
                </span>
                {!item.read && <span className={styles.dot} aria-label={t('Belum dibaca', 'Unread')} />}
              </button>
            ))}
            {page < lastPage && (
              <button type="button" className={styles.more} onClick={() => void load(page + 1)} disabled={loading}>
                {loading ? <Spinner size={16} label={t('Memuat…', 'Loading…')} /> : t('Muat lebih banyak', 'Load more')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
