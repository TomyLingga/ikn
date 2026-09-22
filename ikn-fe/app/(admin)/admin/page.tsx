'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import SessionLoader from '@/components/SessionLoader';
import AdminSalesChart, { type SalesChartPoint } from '@/components/admin/AdminSalesChart';
import { AdminPageHead, DataTable, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderStatus, paymentStatus } from '@/lib/commerce';
import { api, errorMessage } from '@/lib/api';
import { formatIDR, formatDate } from '@/lib/format';
import type { IconName, Order } from '@/lib/types';
import styles from './AdminDashboard.module.css';

interface DashboardStats {
  ordersThisMonth: number;
  revenueThisMonth: number;
  activeCustomers: number;
  pendingVerification: number;
}

interface DashboardData {
  stats: DashboardStats;
  needsAction: Order[];
  recentOrders: Order[];
  salesByMonth: SalesChartPoint[];
}

export default function AdminDashboard() {
  const { lang } = useLang();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api<DashboardData>('/admin/dashboard');
      setData(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading && !data) {
    return (
      <SessionLoader
        message={lang === 'en' ? 'Loading dashboard...' : 'Memuat dashboard...'}
        portalName={lang === 'en' ? 'Admin Backoffice' : 'Back-office Admin'}
      />
    );
  }

  if (error && !data) {
    return (
      <div>
        <AdminPageHead
          title="Dashboard"
          desc={lang === 'en' ? 'Transaction and operational summary for PT IKN.' : 'Ringkasan transaksi dan aktivitas operasional PT IKN.'}
        />
        <p className="form-error">{error}</p>
        <button type="button" className="btn btn-line btn-sm" onClick={() => void refresh()}>
          {lang === 'en' ? 'Reload' : 'Muat ulang'}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { stats, needsAction, recentOrders, salesByMonth } = data;

  const statCards: Array<{
    key: string;
    label: string;
    value: string;
    icon: IconName;
    href: string;
    actionLabel: string;
    warning?: boolean;
  }> = [
    {
      key: 'orders',
      label: lang === 'en' ? 'Orders this month' : 'Order bulan ini',
      value: String(stats.ordersThisMonth),
      icon: 'orders',
      href: '/admin/orders',
      actionLabel: lang === 'en' ? 'View orders' : 'Lihat order',
    },
    {
      key: 'revenue',
      label: lang === 'en' ? 'Revenue this month' : 'Pendapatan bulan ini',
      value: formatIDR(stats.revenueThisMonth),
      icon: 'trendUp',
      href: '/admin/reports/sales',
      actionLabel: lang === 'en' ? 'View report' : 'Lihat laporan',
    },
    {
      key: 'customers',
      label: lang === 'en' ? 'Active customers' : 'Customer aktif',
      value: String(stats.activeCustomers),
      icon: 'users',
      href: '/admin/customers',
      actionLabel: lang === 'en' ? 'View customers' : 'Lihat customer',
    },
    {
      key: 'pending',
      label: lang === 'en' ? 'Pending verification' : 'Menunggu verifikasi',
      value: String(stats.pendingVerification),
      icon: 'shieldCheck',
      href: '/admin/payments',
      actionLabel: lang === 'en' ? 'Open Payments' : 'Buka Payment',
      warning: stats.pendingVerification > 0,
    },
  ];

  const recentColumns: Column<Order>[] = [
    {
      key: 'number',
      label: lang === 'en' ? 'Order No.' : 'No. Order',
      render: (order) => <Link href={`/admin/orders/${order.number}`} className="mono link">{order.number}</Link>,
    },
    { key: 'customer', label: 'Customer', render: (order) => order.customer.name },
    { key: 'date', label: lang === 'en' ? 'Date' : 'Tanggal', render: (order) => formatDate(order.date) },
    { key: 'total', label: 'Total', align: 'right', render: (order) => formatIDR(order.total) },
    {
      key: 'payment',
      label: lang === 'en' ? 'Payment' : 'Pembayaran',
      render: (order) => (
        <StatusBadge
          label={paymentStatus[order.payment]?.[lang] || paymentStatus[order.payment]?.id || order.payment}
          tone={paymentStatus[order.payment]?.tone}
          small
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (order) => (
        <StatusBadge
          label={orderStatus[order.status]?.[lang] || orderStatus[order.status]?.id || order.status}
          tone={orderStatus[order.status]?.tone}
          small
        />
      ),
    },
  ];

  return (
    <div className={styles.dashboard}>
      <AdminPageHead
        title="Dashboard"
        desc={lang === 'en' ? 'Transaction and operational summary for PT IKN.' : 'Ringkasan transaksi dan aktivitas operasional PT IKN.'}
      />

      {error && <p className="form-error">{error}</p>}

      <section className={styles.stats} aria-label="Ringkasan kinerja bulan ini">
        {statCards.map((stat) => (
          <article
            key={stat.key}
            className={`${styles.statCard} ${stat.warning ? styles.warningStatCard : ''}`}
          >
            <div className={styles.statHeading}>
              <Icon name={stat.icon} size={22} strokeWidth={1.7} />
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
            <div className={styles.metricRow}>
              <strong className={styles.statValue}>{stat.value}</strong>
            </div>
            <div className={styles.statFooter}>
              <Link href={stat.href} className={styles.statLink}>{stat.actionLabel} <Icon name="arrow" size={16} /></Link>
            </div>
          </article>
        ))}
      </section>

      <AdminSalesChart data={salesByMonth} />

      <section
        className={`${styles.listCard} ${needsAction.length > 0 ? styles.warningCard : ''}`}
        aria-labelledby="needs-action-title"
      >
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.eyebrow}>{lang === 'en' ? 'Action Required' : 'Perlu tindakan'}</span>
            <h2 id="needs-action-title">{lang === 'en' ? 'Orders Awaiting Admin' : 'Order yang menunggu admin'}</h2>
          </div>
          <Link href="/admin/payments" className={styles.textLink}>
            {lang === 'en' ? 'Open Payments' : 'Buka Payment'} <Icon name="arrow" size={16} />
          </Link>
        </div>
        <p className={styles.sectionDesc}>
          {lang === 'en'
            ? 'Payments awaiting verification and orders being processed or packed.'
            : 'Pembayaran menunggu verifikasi serta pesanan yang sedang diproses/dikemas.'}
        </p>
        <div className={styles.orderList}>
          {needsAction.length === 0 && (
            <p className="admin-note">
              {lang === 'en' ? 'No orders awaiting action.' : 'Tidak ada order yang menunggu tindakan.'}
            </p>
          )}
          {needsAction.map((order) => {
            const needsVerification = order.payment === 'awaiting_confirmation';
            const statusLabel = orderStatus[order.status]?.[lang] || orderStatus[order.status]?.id || order.status;
            return (
              <Link
                key={order.number}
                href={needsVerification ? '/admin/payments' : `/admin/orders/${order.number}`}
                className={styles.orderRow}
              >
                <span className={styles.orderMain}>
                  <strong>{order.number}</strong>
                  <small>{order.customer.name} · {formatDate(order.date)}</small>
                </span>
                <span className={styles.orderAmount}>{formatIDR(order.total)}</span>
                {needsVerification ? (
                  <StatusBadge label={lang === 'en' ? 'Verify proof' : 'Periksa bukti'} tone="warn" />
                ) : (
                  <StatusBadge label={statusLabel} tone={orderStatus[order.status]?.tone} />
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
            <span className={styles.eyebrow}>{lang === 'en' ? 'Recent Activity' : 'Aktivitas terbaru'}</span>
            <h2 id="recent-title">{lang === 'en' ? 'Recent Orders' : 'Pesanan terbaru'}</h2>
          </div>
          <Link href="/admin/orders" className={styles.textLink}>
            {lang === 'en' ? 'All Orders' : 'Semua order'} <Icon name="arrow" size={16} />
          </Link>
        </div>
        <p className={styles.sectionDesc}>
          {lang === 'en' ? 'Latest transactions from all customers.' : 'Transaksi terakhir dari seluruh customer.'}
        </p>
        <DataTable
          columns={recentColumns}
          rows={recentOrders}
          rowKey="number"
          empty={lang === 'en' ? 'No orders yet.' : 'Belum ada order.'}
        />
      </section>
    </div>
  );
}
