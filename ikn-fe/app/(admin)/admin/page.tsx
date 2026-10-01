'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AdminSalesChart from '@/components/admin/AdminSalesChart';
import { AdminPageHead, DataTable, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderLabel, paymentLabel } from '@/lib/commerce';
import { api, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { formatIDR, formatDate, formatDateTime } from '@/lib/format';
import type { DashboardData, DashboardMetric, DashboardWorkQueue } from '@/lib/admin';
import type { IconName, Lang, OrderSummary } from '@/lib/types';
import styles from './AdminDashboard.module.css';

const CURRENT_YEAR = new Date().getFullYear();

type T = (id: string, en: string) => string;

// Dashboard admin: GET /admin/dashboard?year. Urutan: KPI (bulan berjalan vs rentang sama bulan lalu) → antrean kerja
// (hanya modul yang dimiliki admin) → grafik 12 bulan → daftar dua kolom (tindakan, jatuh tempo, terlaris, stok) →
// order terbaru.
export default function AdminDashboard() {
  const { lang } = useLang();
  const t: T = (id, en) => (lang === 'en' ? en : id);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api<DashboardData>(`/admin/dashboard?year=${year}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const desc = t(
    'Ringkasan penjualan dan pekerjaan operasional hari ini.',
    "Today's sales summary and operational work.",
  );

  if (!data) {
    return (
      <div className={styles.dashboard}>
        <AdminPageHead title="Dashboard" desc={desc} />
        {error ? (
          <div className={styles.errorBox} role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn-line btn-sm" onClick={() => void refresh()}>
              {t('Muat ulang', 'Reload')}
            </button>
          </div>
        ) : (
          <DashboardSkeleton label={t('Memuat dashboard...', 'Loading dashboard...')} />
        )}
      </div>
    );
  }

  const { kpis, period, workQueue, needsAction, recentOrders, salesChart, topProducts, lowStock, paymentDue } = data;
  const range = (from: string, to: string) => {
    const a = formatDate(from, lang);
    const b = formatDate(to, lang);
    return a === b ? a : `${a} – ${b}`;
  };
  const periodText = range(period.from, period.to);
  const previousText = range(period.previousFrom, period.previousTo);

  const kpiCards: Array<{ key: string; label: string; icon: IconName; metric: DashboardMetric; money?: boolean; href: string }> = [
    { key: 'revenue', label: t('Pendapatan', 'Revenue'), icon: 'trendUp', metric: kpis.revenue, money: true, href: '/admin/reports/sales' },
    { key: 'orders', label: t('Order dibayar', 'Paid orders'), icon: 'orders', metric: kpis.paidOrders, href: '/admin/reports/sales' },
    { key: 'aov', label: t('Rata-rata nilai order', 'Average order value'), icon: 'wallet', metric: kpis.avgOrderValue, money: true, href: '/admin/reports/sales' },
    { key: 'customers', label: t('Customer baru', 'New customers'), icon: 'users', metric: kpis.newCustomers, href: '/admin/customers' },
  ];

  const recentColumns: Column<OrderSummary>[] = [
    {
      key: 'number',
      label: t('No. Order', 'Order No.'),
      render: (order) => (
        <span>
          <Link href={`/admin/orders/${encodeURIComponent(order.number)}`} className="mono link">
            {order.number}
          </Link>
          {order.invoiceNumber && <small className="admin-cell-sub mono">{order.invoiceNumber}</small>}
        </span>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (order) => (
        <span>
          {order.customer.company || order.customer.name}
          {order.customer.company && order.customer.pic && <small className="admin-cell-sub">{order.customer.pic}</small>}
        </span>
      ),
    },
    { key: 'date', label: t('Tanggal', 'Date'), render: (order) => formatDateTime(order.date, lang) },
    { key: 'total', label: 'Total', align: 'right', render: (order) => formatIDR(order.grandTotal) },
    {
      key: 'payment',
      label: t('Pembayaran', 'Payment'),
      render: (order) =>
        order.paymentStatus ? (
          <StatusBadge label={paymentLabel(order.paymentStatus)[lang]} tone={paymentLabel(order.paymentStatus).tone} small />
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (order) => <StatusBadge label={orderLabel(order.status)[lang]} tone={orderLabel(order.status).tone} small />,
    },
  ];

  const now = Date.now();

  return (
    <div className={styles.dashboard} aria-busy={loading}>
      <div className={styles.head}>
        <AdminPageHead title="Dashboard" desc={desc} />
        <div className={styles.headMeta}>
          <span className={styles.periodChip} title={`${t('Dibandingkan dengan', 'Compared with')} ${previousText}`}>
            <Icon name="clock" size={14} /> {periodText}
          </span>
          <button type="button" className="btn btn-line btn-sm" onClick={() => void refresh()} disabled={loading}>
            {loading ? t('Memuat...', 'Loading...') : t('Segarkan', 'Refresh')}
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {/* KPI: bulan berjalan s.d. hari ini vs rentang yang sama bulan lalu */}
      <section className={styles.kpis} aria-label={t('Kinerja bulan ini', 'This month performance')}>
        {kpiCards.map((card) => (
          <Link key={card.key} href={card.href} className={styles.kpiCard}>
            <span className={styles.kpiLabel}>
              <Icon name={card.icon} size={18} strokeWidth={1.8} /> {card.label}
            </span>
            <strong className={styles.kpiValue}>{card.money ? formatIDR(card.metric.current) : card.metric.current}</strong>
            <span className={styles.kpiCompare}>
              <Delta metric={card.metric} t={t} lang={lang} />
              <span className={styles.kpiPrev}>
                {t('bln lalu', 'last month')}: {card.money ? formatIDR(card.metric.previous) : card.metric.previous}
              </span>
            </span>
          </Link>
        ))}
      </section>
      <p className={styles.kpiNote}>
        {t(
          `Periode ${periodText}, dibandingkan dengan rentang yang sama bulan lalu (${previousText}). Pendapatan dari order yang sudah dibayar (tanggal bayar).`,
          `Period ${periodText}, compared with the same span last month (${previousText}). Revenue counts paid orders by payment date.`,
        )}
      </p>

      <WorkQueue queue={workQueue} t={t} />

      <AdminSalesChart data={salesChart} year={year} onYearChange={setYear} loading={loading} />

      <div className={styles.columns}>
        <div className={styles.column}>
          <Panel
            eyebrow={t('Perlu tindakan', 'Action required')}
            title={t('Order yang menunggu admin', 'Orders awaiting admin')}
            href="/admin/orders"
            linkLabel={t('Semua order', 'All orders')}
            warning={needsAction.length > 0}
          >
            {needsAction.length === 0 ? (
              <EmptyState icon="checkCircle" text={t('Tidak ada order yang menunggu tindakan.', 'No orders awaiting action.')} />
            ) : (
              <div className={styles.rows}>
                {needsAction.slice(0, 6).map((order) => {
                  const verify = order.status === 'payment_review';
                  return (
                    <Link
                      key={order.number}
                      href={verify ? '/admin/payments' : `/admin/orders/${encodeURIComponent(order.number)}`}
                      className={styles.row}
                    >
                      <span className={styles.rowMain}>
                        <strong className="mono">{order.number}</strong>
                        <small>
                          {order.customer.company || order.customer.name} · {formatDateTime(order.date, lang)}
                        </small>
                      </span>
                      <span className={styles.rowSide}>
                        <span className={styles.amount}>{formatIDR(order.grandTotal)}</span>
                        {verify ? (
                          <StatusBadge label={t('Periksa bukti', 'Verify proof')} tone="warn" small />
                        ) : (
                          <StatusBadge label={orderLabel(order.status)[lang]} tone={orderLabel(order.status).tone} small />
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            eyebrow={t('Tagihan', 'Billing')}
            title={t('Jatuh tempo pembayaran', 'Payment deadlines')}
            href="/admin/orders?status=pending_payment"
            linkLabel={t('Menunggu bayar', 'Awaiting payment')}
            warning={paymentDue.overdue > 0}
            meta={
              <span className={styles.pills}>
                {paymentDue.overdue > 0 && (
                  <span className={`${styles.pill} ${styles.pillRed}`}>
                    {paymentDue.overdue} {t('lewat', 'overdue')}
                  </span>
                )}
                <span className={`${styles.pill} ${styles.pillWarn}`}>
                  {paymentDue.dueSoon} {t(`≤ ${paymentDue.windowHours} jam`, `≤ ${paymentDue.windowHours} h`)}
                </span>
              </span>
            }
          >
            {paymentDue.items.length === 0 ? (
              <EmptyState
                icon="clock"
                text={t(
                  `Tidak ada tagihan yang jatuh tempo dalam ${paymentDue.windowHours} jam.`,
                  `No payments due within ${paymentDue.windowHours} hours.`,
                )}
              />
            ) : (
              <div className={styles.rows}>
                {paymentDue.items.map((order) => {
                  const due = order.paymentDueAt ? new Date(order.paymentDueAt).getTime() : now;
                  const overdue = due < now;
                  return (
                    <Link key={order.number} href={`/admin/orders/${encodeURIComponent(order.number)}`} className={styles.row}>
                      <span className={styles.rowMain}>
                        <strong className="mono">{order.number}</strong>
                        <small>{order.customer.company || order.customer.name}</small>
                      </span>
                      <span className={styles.rowSide}>
                        <span className={styles.amount}>{formatIDR(order.grandTotal)}</span>
                        <span className={`${styles.dueText} ${overdue ? styles.dueOver : ''}`}>
                          {overdue ? t('Lewat', 'Overdue') : t('Tempo', 'Due')} {relativeTime(due - now, lang)}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className={styles.column}>
          <Panel
            eyebrow={t('Bulan ini', 'This month')}
            title={t('Produk terlaris', 'Top products')}
            href="/admin/reports/sales"
            linkLabel={t('Laporan', 'Report')}
          >
            {topProducts.length === 0 ? (
              <EmptyState icon="package" text={t('Belum ada penjualan dibayar bulan ini.', 'No paid sales this month yet.')} />
            ) : (
              <ol className={styles.rank}>
                {topProducts.map((product, index) => {
                  const best = topProducts[0]?.revenue ?? 0;
                  const share = best > 0 ? (product.revenue / best) * 100 : 0;
                  return (
                    <li key={product.productId} className={styles.rankItem}>
                      <span className={styles.rankNo}>{index + 1}</span>
                      <span className={styles.rankBody}>
                        <span className={styles.rankTop}>
                          <strong>{tr(product.name, lang) || product.code || '—'}</strong>
                          <span className={styles.amount}>{formatIDR(product.revenue)}</span>
                        </span>
                        <span className={styles.bar} aria-hidden="true">
                          <span style={{ width: `${Math.max(share, 3)}%` }} />
                        </span>
                        <small>
                          {product.qty.toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID')} {product.unit || ''} ·{' '}
                          {product.orders} {t('order', product.orders === 1 ? 'order' : 'orders')}
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel
            eyebrow={t('Persediaan', 'Inventory')}
            title={t('Stok menipis', 'Low stock')}
            href="/admin/products"
            linkLabel={t('Kelola stok', 'Manage stock')}
            warning={lowStock.total > 0}
            meta={
              lowStock.total > 0 ? (
                <span className={`${styles.pill} ${styles.pillWarn}`}>
                  {lowStock.total} {t('produk', lowStock.total === 1 ? 'product' : 'products')}
                </span>
              ) : undefined
            }
          >
            {lowStock.items.length === 0 ? (
              <EmptyState icon="checkCircle" text={t('Semua stok produk harga tetap aman.', 'All fixed-price stock levels are healthy.')} />
            ) : (
              <div className={styles.rows}>
                {lowStock.items.map((item) => {
                  const pct = item.threshold > 0 ? Math.min(100, Math.max(0, (item.available / item.threshold) * 100)) : 0;
                  const empty = item.available <= 0;
                  return (
                    <Link key={item.id} href="/admin/products" className={styles.row}>
                      <span className={styles.thumb} aria-hidden="true">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt="" loading="lazy" />
                        ) : (
                          <Icon name="package" size={18} />
                        )}
                      </span>
                      <span className={styles.rowMain}>
                        <strong>{tr(item.name, lang) || item.slug}</strong>
                        <span className={`${styles.stockBar} ${empty ? styles.stockEmpty : ''}`} aria-hidden="true">
                          <span style={{ width: `${Math.max(pct, 2)}%` }} />
                        </span>
                        <small>
                          {item.code ? `${item.code} · ` : ''}
                          {t('batas', 'threshold')} {item.threshold} · MOQ {item.moq}
                          {item.reserved > 0 ? ` · ${item.reserved} ${t('dipesan', 'reserved')}` : ''}
                        </small>
                      </span>
                      <span className={styles.stockQty}>
                        <strong className={empty ? styles.textRed : styles.textWarn}>{item.available}</strong>
                        <small>{item.unit || ''}</small>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        eyebrow={t('Aktivitas terbaru', 'Recent activity')}
        title={t('Order terbaru', 'Recent orders')}
        href="/admin/orders?status=all"
        linkLabel={t('Semua order', 'All orders')}
      >
        <DataTable columns={recentColumns} rows={recentOrders} rowKey="number" pagination={false} empty={t('Belum ada order.', 'No orders yet.')} />
      </Panel>
    </div>
  );
}

// ---- Bagian kecil ----

function Delta({ metric, t, lang }: { metric: DashboardMetric; t: T; lang: Lang }) {
  if (metric.changePct === null) {
    return metric.current > 0 ? (
      <span className={`${styles.delta} ${styles.deltaUp}`}>{t('Baru', 'New')}</span>
    ) : (
      <span className={`${styles.delta} ${styles.deltaFlat}`}>—</span>
    );
  }
  const pct = metric.changePct;
  const tone = pct > 0 ? styles.deltaUp : pct < 0 ? styles.deltaDown : styles.deltaFlat;
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '•';
  const text = `${Math.abs(pct).toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID', { maximumFractionDigits: 1 })}%`;
  return (
    <span className={`${styles.delta} ${tone}`} title={t('Perubahan dibanding bulan lalu', 'Change vs last month')}>
      <span aria-hidden="true">{arrow}</span> {text}
    </span>
  );
}

interface QueueItem {
  key: keyof DashboardWorkQueue;
  label: string;
  hint: string;
  icon: IconName;
  href: string;
  urgent?: boolean;
}

function WorkQueue({ queue, t }: { queue: DashboardWorkQueue; t: T }) {
  const items: QueueItem[] = [
    { key: 'paymentsToVerify', label: t('Verifikasi pembayaran', 'Verify payments'), hint: t('Bukti transfer/QRIS', 'Transfer/QRIS proofs'), icon: 'paymentCheck', href: '/admin/payments', urgent: true },
    { key: 'ordersToProcess', label: t('Siap diproses', 'Ready to process'), hint: t('Sudah dibayar', 'Paid'), icon: 'wallet', href: '/admin/orders?status=paid', urgent: true },
    { key: 'ordersToShip', label: t('Siap dikirim', 'Ready to ship'), hint: t('Sedang diproses', 'Processing'), icon: 'package', href: '/admin/orders?status=processing' },
    { key: 'ordersInTransit', label: t('Dalam pengiriman', 'In transit'), hint: t('Pantau resi', 'Track shipments'), icon: 'truck', href: '/admin/orders?status=shipped' },
    { key: 'ordersDelivered', label: t('Diterima customer', 'Delivered'), hint: t('Menunggu selesai', 'Awaiting completion'), icon: 'checkCircle', href: '/admin/orders?status=delivered' },
    { key: 'paymentsOverdue', label: t('Lewat jatuh tempo', 'Past due'), hint: t('Belum dibayar', 'Unpaid'), icon: 'clock', href: '/admin/orders?status=pending_payment', urgent: true },
    { key: 'customersToApprove', label: t('Persetujuan customer', 'Customer approval'), hint: t('Registrasi baru', 'New sign-ups'), icon: 'users', href: '/admin/customers?status=pending', urgent: true },
    { key: 'unreadChats', label: t('Chat belum dibaca', 'Unread chats'), hint: t('Live chat', 'Live chat'), icon: 'chat', href: '/admin/chat', urgent: true },
  ];
  const visible = items.filter((item) => queue[item.key] !== null);
  if (visible.length === 0) return null;
  const open = visible.reduce((sum, item) => sum + (queue[item.key] || 0), 0);

  return (
    <section className={styles.queue} aria-labelledby="queue-title">
      <div className={styles.queueHead}>
        <h2 id="queue-title">{t('Antrean kerja', 'Work queue')}</h2>
        <span className={styles.queueSub}>
          {open > 0
            ? t(`${open} item menunggu tindakan`, `${open} item${open === 1 ? '' : 's'} waiting`)
            : t('Semua beres. Tidak ada yang menunggu.', 'All clear. Nothing waiting.')}
        </span>
      </div>
      <div className={styles.queueGrid}>
        {visible.map((item) => {
          const count = queue[item.key] || 0;
          const tone = count === 0 ? styles.qDone : item.urgent ? styles.qUrgent : styles.qActive;
          return (
            <Link key={item.key} href={item.href} className={`${styles.qTile} ${tone}`}>
              <span className={styles.qIcon}>
                <Icon name={item.icon} size={18} strokeWidth={1.8} />
              </span>
              <span className={styles.qText}>
                <span className={styles.qLabel}>{item.label}</span>
                <small>{count === 0 ? t('Beres', 'Clear') : item.hint}</small>
              </span>
              <strong className={styles.qCount}>{count}</strong>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Panel({
  eyebrow,
  title,
  href,
  linkLabel,
  warning,
  meta,
  children,
}: {
  eyebrow: string;
  title: string;
  href: string;
  linkLabel: string;
  warning?: boolean;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`${styles.panel} ${warning ? styles.panelWarn : ''}`}>
      <div className={styles.panelHead}>
        <div className={styles.panelTitle}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {meta}
        <Link href={href} className={styles.textLink}>
          {linkLabel} <Icon name="arrow" size={14} />
        </Link>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className={styles.empty}>
      <Icon name={icon} size={22} strokeWidth={1.6} />
      <p>{text}</p>
    </div>
  );
}

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-label={label}>
      <div className={styles.kpis}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${styles.skelBlock} ${styles.skelKpi}`} />
        ))}
      </div>
      <div className={`${styles.skelBlock} ${styles.skelQueue}`} />
      <div className={`${styles.skelBlock} ${styles.skelChart}`} />
      <div className={styles.columns}>
        <div className={`${styles.skelBlock} ${styles.skelList}`} />
        <div className={`${styles.skelBlock} ${styles.skelList}`} />
      </div>
    </div>
  );
}

/** "dalam 5 jam" / "3 jam lalu" style relative text from a millisecond difference. */
function relativeTime(diffMs: number, lang: Lang): string {
  const rtf = new Intl.RelativeTimeFormat(lang === 'en' ? 'en' : 'id', { numeric: 'auto' });
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}
