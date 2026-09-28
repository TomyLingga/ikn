'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import SessionLoader from '@/components/SessionLoader';
import AdminSalesChart from '@/components/admin/AdminSalesChart';
import { AdminPageHead, DataTable, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderLabel, paymentLabel } from '@/lib/commerce';
import { api, errorMessage } from '@/lib/api';
import { formatIDR, formatDateTime } from '@/lib/format';
import type { DashboardData } from '@/lib/admin';
import type { IconName, OrderSummary } from '@/lib/types';
import styles from './AdminDashboard.module.css';

const CURRENT_YEAR = new Date().getFullYear();

// Dashboard admin: GET /admin/dashboard?year (stats, recentOrders, needsAction, salesChart 12 bulan).
export default function AdminDashboard() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
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

  if (loading && !data) {
    return (
      <SessionLoader
        message={t('Memuat dashboard...', 'Loading dashboard...')}
        portalName={t('Back-office Admin', 'Admin Backoffice')}
      />
    );
  }

  if (error && !data) {
    return (
      <div>
        <AdminPageHead title="Dashboard" desc={t('Ringkasan transaksi dan aktivitas operasional PT IKN.', 'Transaction and operational summary for PT IKN.')} />
        <p className="form-error">{error}</p>
        <button type="button" className="btn btn-line btn-sm" onClick={() => void refresh()}>
          {t('Muat ulang', 'Reload')}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { stats, needsAction, recentOrders, salesChart } = data;

  const statCards: Array<{
    key: string;
    label: string;
    value: string;
    icon: IconName;
    href: string;
    actionLabel: string;
    detail?: string;
    warning?: boolean;
  }> = [
    {
      key: 'today',
      label: t('Order hari ini', 'Orders today'),
      value: String(stats.ordersToday),
      icon: 'orders',
      href: '/admin/orders',
      actionLabel: t('Lihat order', 'View orders'),
      detail: `${stats.ordersThisMonth} ${t('order bulan ini', 'orders this month')}`,
    },
    {
      key: 'verify',
      label: t('Menunggu verifikasi bayar', 'Awaiting payment verification'),
      value: String(stats.awaitingVerification),
      icon: 'paymentCheck',
      href: '/admin/payments',
      actionLabel: t('Buka pembayaran', 'Open payments'),
      detail: t('Bukti bayar yang perlu diperiksa admin.', 'Payment proofs waiting for admin review.'),
      warning: stats.awaitingVerification > 0,
    },
    {
      key: 'revenue',
      label: t('Pendapatan bulan ini', 'Revenue this month'),
      value: formatIDR(stats.revenueThisMonth),
      icon: 'trendUp',
      href: '/admin/reports/sales',
      actionLabel: t('Lihat laporan', 'View report'),
      detail: t('Order berstatus dibayar ke atas (tanggal bayar).', 'Paid orders and beyond (by payment date).'),
    },
    {
      key: 'customers',
      label: t('Customer menunggu persetujuan', 'Customers pending approval'),
      value: String(stats.pendingCustomers),
      icon: 'users',
      href: '/admin/customers?status=pending',
      actionLabel: t('Tinjau customer', 'Review customers'),
      detail: `${stats.activeCustomers} ${t('customer aktif', 'active customers')}`,
      warning: stats.pendingCustomers > 0,
    },
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
          {order.invoiceNumber && (
            <small className="admin-cell-sub mono">{order.invoiceNumber}</small>
          )}
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
      render: (order) => <StatusBadge label={paymentLabel(order.paymentStatus)[lang]} tone={paymentLabel(order.paymentStatus).tone} small />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (order) => <StatusBadge label={orderLabel(order.status)[lang]} tone={orderLabel(order.status).tone} small />,
    },
  ];

  return (
    <div className={styles.dashboard}>
      <AdminPageHead title="Dashboard" desc={t('Ringkasan transaksi dan aktivitas operasional PT IKN.', 'Transaction and operational summary for PT IKN.')} />

      {error && <p className="form-error">{error}</p>}

      <section className={styles.stats} aria-label={t('Ringkasan kinerja', 'Performance summary')}>
        {statCards.map((stat) => (
          <article key={stat.key} className={`${styles.statCard} ${stat.warning ? styles.warningStatCard : ''}`}>
            <div className={styles.statHeading}>
              <Icon name={stat.icon} size={22} strokeWidth={1.7} />
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
            <div className={styles.metricRow}>
              <strong className={styles.statValue}>{stat.value}</strong>
            </div>
            {stat.detail && <p className={styles.statDetail}>{stat.detail}</p>}
            <div className={styles.statFooter}>
              <Link href={stat.href} className={styles.statLink}>
                {stat.actionLabel} <Icon name="arrow" size={16} />
              </Link>
            </div>
          </article>
        ))}
      </section>

      <AdminSalesChart data={salesChart} year={year} onYearChange={setYear} loading={loading} />

      <section className={`${styles.listCard} ${needsAction.length > 0 ? styles.warningCard : ''}`} aria-labelledby="needs-action-title">
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.eyebrow}>{t('Perlu tindakan', 'Action required')}</span>
            <h2 id="needs-action-title">{t('Order yang menunggu admin', 'Orders awaiting admin')}</h2>
          </div>
          <Link href="/admin/payments" className={styles.textLink}>
            {t('Buka pembayaran', 'Open payments')} <Icon name="arrow" size={16} />
          </Link>
        </div>
        <p className={styles.sectionDesc}>
          {t(
            'Pembayaran menunggu verifikasi serta pesanan dibayar yang belum diproses/dikirim.',
            'Payments awaiting verification and paid orders not yet processed or shipped.',
          )}
        </p>
        <div className={styles.orderList}>
          {needsAction.length === 0 && (
            <p className="admin-note">{t('Tidak ada order yang menunggu tindakan.', 'No orders awaiting action.')}</p>
          )}
          {needsAction.map((order) => {
            const needsVerification = order.status === 'payment_review';
            return (
              <Link
                key={order.number}
                href={needsVerification ? '/admin/payments' : `/admin/orders/${encodeURIComponent(order.number)}`}
                className={styles.orderRow}
              >
                <span className={styles.orderMain}>
                  <strong>{order.number}</strong>
                  <small>
                    {order.customer.company || order.customer.name} · {formatDateTime(order.date, lang)}
                  </small>
                </span>
                <span className={styles.orderAmount}>{formatIDR(order.grandTotal)}</span>
                {needsVerification ? (
                  <StatusBadge label={t('Periksa bukti', 'Verify proof')} tone="warn" />
                ) : (
                  <StatusBadge label={orderLabel(order.status)[lang]} tone={orderLabel(order.status).tone} />
                )}
                <Icon name="chevronRight" size={18} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.listCard} aria-labelledby="recent-title">
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.eyebrow}>{t('Aktivitas terbaru', 'Recent activity')}</span>
            <h2 id="recent-title">{t('Order terbaru', 'Recent orders')}</h2>
          </div>
          <Link href="/admin/orders" className={styles.textLink}>
            {t('Semua order', 'All orders')} <Icon name="arrow" size={16} />
          </Link>
        </div>
        <p className={styles.sectionDesc}>{t('Sepuluh transaksi terakhir dari seluruh customer.', 'The latest ten transactions from all customers.')}</p>
        <DataTable columns={recentColumns} rows={recentOrders} rowKey="number" pagination={false} empty={t('Belum ada order.', 'No orders yet.')} />
      </section>
    </div>
  );
}
