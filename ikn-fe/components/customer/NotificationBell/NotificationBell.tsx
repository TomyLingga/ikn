'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, type Envelope } from '@/lib/api';
import { tr } from '@/lib/cms';
import { refreshCustomerBadges, timeAgo } from '@/lib/shop';
import type { IconName, UserNotification } from '@/lib/types';
import styles from './NotificationBell.module.css';

const PER_PAGE = 12;

interface ListEnvelope extends Envelope<UserNotification[]> {
  meta?: Envelope['meta'] & { unread?: number };
}

// Ikon per jenis notifikasi (awalan `type` dari API).
function iconFor(type: string): IconName {
  if (type.startsWith('order.payment')) return 'wallet';
  if (type === 'order.shipped' || type === 'order.tracking') return 'truck';
  if (type === 'order.delivered') return 'package';
  if (type === 'order.completed') return 'checkCircle';
  if (type === 'order.cancelled' || type === 'order.expired') return 'cancelCircle';
  if (type.startsWith('order.')) return 'orders';
  if (type.startsWith('voucher.')) return 'tag';
  if (type.startsWith('account.')) return 'shieldCheck';
  return 'bell';
}

interface NotificationBellProps {
  /** Jumlah belum dibaca dari GET /customer/badges (dipolling CustomerShell). */
  unread: number;
}

// Lonceng notifikasi top bar portal (ASUMSI A-71): daftar dimuat saat panel dibuka; klik notifikasi
// menandainya dibaca lalu membuka halaman terkait.
export default function NotificationBell({ unread }: NotificationBellProps) {
  const router = useRouter();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrap = useRef<HTMLDivElement>(null);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api<ListEnvelope>(`/customer/notifications?page=${nextPage}&perPage=${PER_PAGE}`, { raw: true });
      const rows = res.data || [];
      setItems((prev) => (nextPage === 1 ? rows : [...prev, ...rows.filter((row) => !prev.some((p) => p.id === row.id))]));
      setPage(nextPage);
      setLastPage(res.meta?.lastPage ?? 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Muat ulang setiap panel dibuka, dan ketika ada notifikasi baru selagi panel terbuka.
  useEffect(() => {
    if (open) void load(1);
  }, [open, unread, load]);

  useEffect(() => {
    if (!open) return;
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
        await api(`/customer/notifications/${item.id}/read`, { method: 'POST' });
      } catch {
        // Gagal menandai dibaca tidak menghalangi navigasi; badge akan sinkron pada polling berikutnya.
      }
      refreshCustomerBadges();
    }
    if (item.url) router.push(item.url);
  }

  async function readAll() {
    setItems((prev) => prev.map((row) => ({ ...row, read: true })));
    try {
      await api('/customer/notifications/read-all', { method: 'POST' });
    } catch (err) {
      setError(errorMessage(err));
    }
    refreshCustomerBadges();
  }

  const label = unread > 0 ? t(`Notifikasi, ${unread} belum dibaca`, `Notifications, ${unread} unread`) : t('Notifikasi', 'Notifications');

  return (
    <div className={styles.wrap} ref={wrap}>
      <button type="button" className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Icon name="bell" size={20} />
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
                <p>{loading ? t('Memuat notifikasi…', 'Loading notifications…') : t('Belum ada notifikasi. Update pesanan dan akun Anda akan muncul di sini.', 'No notifications yet. Updates on your orders and account will show up here.')}</p>
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
                {loading ? t('Memuat…', 'Loading…') : t('Muat lebih banyak', 'Load more')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
