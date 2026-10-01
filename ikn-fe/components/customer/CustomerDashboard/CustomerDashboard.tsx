'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AccountStatusBanner from '@/components/customer/AccountStatusBanner';
import OrderThumbs from '@/components/customer/OrderThumbs';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { orderLabel } from '@/lib/commerce';
import { api, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';
import { isoDay, monthToDate } from '@/lib/shop';
import type { CustomerDashboardData, IconName, OrderSummary } from '@/lib/types';
import styles from './CustomerDashboard.module.css';

const emptyData: CustomerDashboardData = {
  totalOrders: 0,
  awaitingPayment: 0,
  inProgress: 0,
  completed: 0,
  transactionValue: 0,
  toReview: 0,
  actionOrders: [],
  recentOrders: [],
  monthly: [],
  account: { status: 'pending', rejectionReason: null, canOrder: false },
};

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Preset = 'month' | '30d' | 'year';

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  if (preset === '30d') return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: isoDay(now) };
  if (preset === 'year') return { from: isoDay(new Date(now.getFullYear(), 0, 1)), to: isoDay(now) };
  return monthToDate();
}

// Ringkas rupiah untuk label grafik kecil: 1,2 jt / 850 rb.
function compactIDR(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(value);
}

// Dashboard portal customer: GET /customer/dashboard?from&to.
// - "Masih terbuka" (perlu pembayaran, sedang berjalan, menunggu ulasan, daftar pesanan yang perlu ditindak)
//   selalu sepanjang waktu, supaya pekerjaan yang belum selesai tidak tersembunyi oleh filter tanggal.
// - "Ringkasan periode" (total pesanan, selesai, nilai transaksi, pesanan pada periode) mengikuti rentang
//   tanggal; bawaan awal bulan sampai hari ini.
export default function CustomerDashboard() {
  const { customer } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [range, setRange] = useState(monthToDate);
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const customerId = customer?.id;
  const rangeValid = !!range.from && !!range.to && range.from <= range.to;

  useEffect(() => {
    if (!customerId || !rangeValid) return;
    let active = true;
    setLoading(true);
    setError('');
    api<CustomerDashboardData>(`/customer/dashboard?from=${range.from}&to=${range.to}`)
      .then((raw) => {
        if (active) setData({ ...emptyData, ...raw });
      })
      .catch((err) => {
        if (!active) return;
        setData((prev) => prev ?? emptyData);
        setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId, range.from, range.to, rangeValid]);

  const stats = data || emptyData;
  const monthly = useMemo(() => stats.monthly || [], [stats.monthly]);
  const monthlyMax = Math.max(1, ...monthly.map((m) => m.total));
  const monthlyTotal = monthly.reduce((sum, m) => sum + m.total, 0);
  const activePreset = (['month', '30d', 'year'] as Preset[]).find((p) => {
    const r = presetRange(p);
    return r.from === range.from && r.to === range.to;
  });

  if (!customer) return null;

  const firstName = (customer.name || '').split(' ')[0] || t('Pelanggan', 'Customer');
  const actionOrders = stats.actionOrders || [];
  const recent = stats.recentOrders || [];

  const openTiles: { key: string; value: number; label: string; hint: string; icon: IconName; href: string; tone?: string }[] = [
    {
      key: 'unpaid',
      value: stats.awaitingPayment,
      label: t('Perlu pembayaran', 'Awaiting payment'),
      hint: t('Bayar atau unggah bukti transfer', 'Pay or upload your transfer proof'),
      icon: 'wallet',
      href: '/dashboard/pesanan?tab=unpaid',
      tone: styles.toneWarn,
    },
    {
      key: 'progress',
      value: stats.inProgress,
      label: t('Sedang berjalan', 'In progress'),
      hint: t('Diproses, dikirim, atau menunggu konfirmasi', 'Processing, shipped, or awaiting confirmation'),
      icon: 'truck',
      href: '/dashboard/pesanan?tab=processing',
      tone: styles.toneInfo,
    },
    {
      key: 'review',
      value: stats.toReview ?? 0,
      label: t('Menunggu ulasan', 'Awaiting review'),
      hint: t('Beri penilaian untuk pesanan selesai', 'Rate your completed orders'),
      icon: 'star',
      href: '/dashboard/pesanan?tab=to_review',
      tone: styles.toneOk,
    },
  ];

  function actionFor(order: OrderSummary): { label: string; href: string; primary: boolean } {
    const detail = `/dashboard/pesanan/${encodeURIComponent(order.number)}`;
    switch (order.status) {
      case 'pending_payment':
        return { label: t('Bayar sekarang', 'Pay now'), href: `${detail}#payment`, primary: true };
      case 'payment_review':
        return { label: t('Lihat pembayaran', 'View payment'), href: `${detail}#payment`, primary: false };
      case 'shipped':
        return { label: t('Lacak & konfirmasi', 'Track & confirm'), href: `${detail}#tracking`, primary: true };
      case 'delivered':
        return { label: t('Selesaikan pesanan', 'Complete order'), href: `${detail}#tracking`, primary: true };
      default:
        return { label: t('Lacak pesanan', 'Track order'), href: `${detail}#tracking`, primary: false };
    }
  }

  function actionNote(order: OrderSummary): string {
    if (order.status === 'pending_payment' && order.paymentDueAt) return `${t('Bayar sebelum', 'Pay before')} ${formatDateTime(order.paymentDueAt, lang)}`;
    if (order.status === 'payment_review') return t('Bukti pembayaran sedang diverifikasi admin', 'Your payment proof is being verified');
    if (order.status === 'shipped') return order.trackingNumber ? `${order.courier || ''} ${order.trackingNumber}`.trim() : t('Pesanan dalam perjalanan', 'Your order is on its way');
    if (order.status === 'delivered') return t('Barang sudah sampai; konfirmasi selesai bila sesuai', 'Goods have arrived; confirm completion if all is in order');
    return t('Pesanan sedang kami siapkan', 'We are preparing your order');
  }

  return (
    <div className={styles.page}>
      <AccountStatusBanner />

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroEyebrow}>{customer.company || t('Portal customer', 'Customer portal')}</span>
          <h1>
            {t('Selamat datang,', 'Welcome,')} {firstName}.
          </h1>
          <p>{t('Pantau pesanan, selesaikan pembayaran, dan belanja lagi dari satu tempat.', 'Track orders, settle payments, and reorder from one place.')}</p>
          <div className={styles.heroActions}>
            <Link href="/dashboard/katalog" className={styles.heroPrimary}>
              <Icon name="store" size={18} /> {t('Belanja produk', 'Shop products')}
            </Link>
            <Link href="/dashboard/pesanan" className={styles.heroGhost}>
              {t('Pesanan saya', 'My orders')} <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>

        <div className={styles.spend} aria-label={t('Belanja enam bulan terakhir', 'Spending in the last six months')}>
          <div className={styles.spendHead}>
            <span>{t('Belanja 6 bulan terakhir', 'Spending, last 6 months')}</span>
            <strong>{formatIDR(monthlyTotal)}</strong>
          </div>
          <div className={styles.spendBars}>
            {monthly.map((month) => (
              <div
                key={month.ym}
                className={styles.spendCol}
                title={`${lang === 'en' ? MONTHS_EN[month.monthIndex - 1] : month.month} ${month.year}: ${formatIDR(month.total)} · ${month.orders} ${t('pesanan', 'orders')}`}
              >
                <span className={styles.spendValue}>{month.total > 0 ? compactIDR(month.total) : ''}</span>
                <span className={styles.spendTrack}>
                  <span className={`${styles.spendFill} ${month.total > 0 ? '' : styles.spendZero}`} style={{ '--h': `${Math.max(3, (month.total / monthlyMax) * 100)}%` } as CSSProperties} />
                </span>
                <span className={styles.spendLabel}>{lang === 'en' ? MONTHS_EN[month.monthIndex - 1] : month.month}</span>
              </div>
            ))}
            {monthly.length === 0 && <p className={styles.spendEmpty}>{loading ? t('Memuat…', 'Loading…') : t('Belum ada transaksi.', 'No transactions yet.')}</p>}
          </div>
        </div>
      </section>

      {error && (
        <p className="form-error" role="alert">
          {t('Ringkasan belum tersedia', 'Summary unavailable')}: {error}
        </p>
      )}

      <section aria-labelledby="dash-open-title">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="dash-open-title">{t('Masih terbuka', 'Still open')}</h2>
            <p>{t('Semua pesanan yang belum selesai, tanpa filter tanggal.', 'Every unfinished order, regardless of the date filter.')}</p>
          </div>
        </div>
        <div className={styles.openGrid}>
          {openTiles.map((tile) => (
            <Link key={tile.key} href={tile.href} className={`${styles.openTile} ${tile.tone || ''}`}>
              <span className={styles.openIcon}>
                <Icon name={tile.icon} size={20} />
              </span>
              <span className={styles.openBody}>
                <strong>{tile.value}</strong>
                <span>{tile.label}</span>
                <small>{tile.hint}</small>
              </span>
              <Icon name="chevronRight" size={18} className={styles.openArrow} />
            </Link>
          ))}
        </div>

        {actionOrders.length > 0 && (
          <div className={styles.actionList}>
            {actionOrders.map((order) => {
              const status = orderLabel(order.status);
              const action = actionFor(order);
              const first = order.items[0];
              return (
                <article key={order.number} className={styles.actionCard}>
                  <OrderThumbs items={order.items} size={52} max={2} />
                  <div className={styles.actionBody}>
                    <div className={styles.actionTop}>
                      <Link href={`/dashboard/pesanan/${encodeURIComponent(order.number)}`} className={styles.orderNo}>
                        {order.number}
                      </Link>
                      <StatusBadge label={status[lang]} tone={status.tone} small />
                    </div>
                    <span className={styles.actionItems}>
                      {first ? tr(first.name, lang) : ''}
                      {order.itemsCount > 1 ? ` +${order.itemsCount - 1} ${t('produk lain', 'more')}` : ''} · {formatIDR(order.grandTotal)}
                    </span>
                    <small>{actionNote(order)}</small>
                  </div>
                  <Link href={action.href} className={`${styles.actionBtn} ${action.primary ? styles.actionBtnPrimary : ''}`}>
                    {action.label}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="dash-period-title">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="dash-period-title">{t('Ringkasan periode', 'Period summary')}</h2>
            <p>
              {rangeValid
                ? `${formatDate(range.from, lang)} – ${formatDate(range.to, lang)}`
                : t('Tanggal awal harus sebelum tanggal akhir.', 'The start date must be before the end date.')}
            </p>
          </div>
          <div className={styles.rangeBar}>
            <div className={styles.presets} role="group" aria-label={t('Pilihan cepat periode', 'Period presets')}>
              {(
                [
                  ['month', t('Bulan ini', 'This month')],
                  ['30d', t('30 hari', '30 days')],
                  ['year', t('Tahun ini', 'This year')],
                ] as [Preset, string][]
              ).map(([key, label]) => (
                <button key={key} type="button" className={activePreset === key ? styles.presetOn : ''} aria-pressed={activePreset === key} onClick={() => setRange(presetRange(key))}>
                  {label}
                </button>
              ))}
            </div>
            <label className={styles.dateField}>
              <span>{t('Dari', 'From')}</span>
              <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            </label>
            <label className={styles.dateField}>
              <span>{t('Sampai', 'To')}</span>
              <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </label>
          </div>
        </div>

        <div className={styles.statGrid} aria-busy={loading}>
          <div className={styles.stat}>
            <span>{t('Total pesanan', 'Total orders')}</span>
            <strong>{stats.totalOrders}</strong>
            <small>{t('dibuat pada periode ini', 'placed in this period')}</small>
          </div>
          <div className={styles.stat}>
            <span>{t('Selesai', 'Completed')}</span>
            <strong>{stats.completed}</strong>
            <small>{t('dari pesanan periode ini', 'of the orders in this period')}</small>
          </div>
          <div className={`${styles.stat} ${styles.statWide}`}>
            <span>{t('Nilai transaksi', 'Transaction value')}</span>
            <strong>{formatIDR(stats.transactionValue)}</strong>
            <small>{t('pembayaran terverifikasi pada periode ini', 'payments verified in this period')}</small>
          </div>
        </div>

        <div className={styles.recent}>
          <div className={styles.recentHead}>
            <h3>{t('Pesanan pada periode ini', 'Orders in this period')}</h3>
            <Link href="/dashboard/pesanan" className={styles.textLink}>
              {t('Semua pesanan', 'All orders')} <Icon name="arrow" size={15} />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className={styles.recentEmpty}>
              <Icon name="orders" size={28} strokeWidth={1.3} />
              <p>{loading ? t('Memuat pesanan…', 'Loading orders…') : t('Belum ada pesanan pada periode ini.', 'No orders in this period yet.')}</p>
              {!loading && (
                <Link href="/dashboard/katalog" className={styles.textLink}>
                  {t('Mulai belanja', 'Start shopping')} <Icon name="arrow" size={15} />
                </Link>
              )}
            </div>
          ) : (
            <ul className={styles.recentList}>
              {recent.map((order) => {
                const status = orderLabel(order.status);
                const first = order.items[0];
                return (
                  <li key={order.number}>
                    <Link href={`/dashboard/pesanan/${encodeURIComponent(order.number)}`} className={styles.recentRow}>
                      <OrderThumbs items={order.items} size={44} max={1} />
                      <span className={styles.recentMain}>
                        <strong>{first ? tr(first.name, lang) : order.number}{order.itemsCount > 1 ? ` +${order.itemsCount - 1}` : ''}</strong>
                        <small>
                          {order.number} · {formatDate(order.date, lang)}
                        </small>
                      </span>
                      <StatusBadge label={status[lang]} tone={status.tone} small />
                      <span className={styles.recentTotal}>{formatIDR(order.grandTotal)}</span>
                      <Icon name="chevronRight" size={17} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="dash-quick-title">
        <div className={styles.sectionHead}>
          <h2 id="dash-quick-title">{t('Pintasan', 'Shortcuts')}</h2>
        </div>
        <div className={styles.quickGrid}>
          {(
            [
              ['/dashboard/katalog', 'store', t('Belanja produk', 'Shop products'), t('Lihat harga dan stok terbaru', 'See the latest prices and stock')],
              ['/dashboard/alamat', 'pin', t('Alamat pengiriman', 'Shipping addresses'), t('Atur tujuan pengiriman', 'Manage delivery destinations')],
              ['/dashboard/perusahaan', 'orders', t('Data perusahaan', 'Company details'), t('NPWP dan kontak perusahaan', 'Tax ID and company contacts')],
              ['/dashboard/profil', 'users', t('Profil & kata sandi', 'Profile & password'), t('Data PIC dan keamanan akun', 'PIC details and account security')],
            ] as [string, IconName, string, string][]
          ).map(([href, icon, label, body]) => (
            <Link key={href} href={href} className={styles.quick}>
              <span className={styles.quickIcon}>
                <Icon name={icon} size={20} />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{body}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
