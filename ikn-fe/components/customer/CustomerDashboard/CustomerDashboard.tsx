'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import AccountStatusBanner from '@/components/customer/AccountStatusBanner';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { t as dict } from '@/lib/i18n';
import { orderLabel } from '@/lib/commerce';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatIDR } from '@/lib/format';
import type { CustomerDashboardData, IconName, OrderSummary } from '@/lib/types';

const emptyData: CustomerDashboardData = {
  totalOrders: 0,
  awaitingPayment: 0,
  inProgress: 0,
  completed: 0,
  transactionValue: 0,
  recentOrders: [],
  account: { status: 'pending', rejectionReason: null, canOrder: false },
};

// GET /customer/dashboard (BE-3): statistik datar + recentOrders[] (ringkasan) + status akun.
export default function CustomerDashboard() {
  const { customer } = useAuth();
  const { lang } = useLang();
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customer) return;
    let active = true;
    api<CustomerDashboardData>('/customer/dashboard')
      .then((raw) => {
        if (active) setData({ ...emptyData, ...raw, recentOrders: Array.isArray(raw.recentOrders) ? raw.recentOrders : [] });
      })
      .catch((err) => {
        if (!active) return;
        setData(emptyData);
        setError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [customer]);

  if (!customer) return null;

  const ui = dict[lang] || dict.id;
  const d = ui.dash;
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const quickActions: { href: string; label: string; body: string; icon: IconName }[] = [
    { href: '/dashboard/katalog', label: d.quick.catalog, body: d.quick.catalogDesc, icon: 'flask' },
    { href: '/dashboard/pesanan', label: d.quick.orders, body: d.quick.ordersDesc, icon: 'drop' },
    { href: '/dashboard/alamat', label: d.quick.address, body: d.quick.addressDesc, icon: 'pin' },
    { href: '/dashboard/profil', label: d.quick.profile, body: d.quick.profileDesc, icon: 'handshake' },
  ];

  const stats = data || emptyData;
  const recent = data?.recentOrders || [];
  // Ringkasan tidak membawa flag can*; perhatian diturunkan dari status.
  const alerts = recent.filter((o) => o.status === 'pending_payment' || o.status === 'shipped');
  const customerName = (customer.name || '').split(' ')[0] || t('Pelanggan', 'Customer');

  function alertMessage(order: OrderSummary): { text: string; icon: IconName } {
    if (order.status === 'pending_payment') return { text: d.alerts.unpaid.replace('{num}', order.number), icon: 'wallet' };
    return { text: d.alerts.shipped.replace('{num}', order.number) + (order.trackingNumber ? ` (${order.trackingNumber})` : ''), icon: 'truck' };
  }

  return (
    <div className="customer-dashboard">
      <AccountStatusBanner />

      <section className="dash-welcome">
        <div>
          <span className="label label-amber">{d.title}</span>
          <h2 className="h2">{d.welcome} {customerName}.</h2>
          <p>{customer.company || customer.name} · {d.subtitle}</p>
        </div>
        <Link href="/dashboard/katalog" className="btn btn-solid">
          {d.shop} <Icon name="arrow" />
        </Link>
      </section>

      {error && <p className="form-error" role="alert">{t('Ringkasan belum tersedia', 'Summary unavailable')}: {error}</p>}

      <section className="acct-stats" aria-label={t('Ringkasan pesanan', 'Order summary')}>
        <div className="acct-stat"><span className="acct-stat-val">{stats.totalOrders}</span><span className="acct-stat-label">{d.stats.total}</span></div>
        <div className="acct-stat"><span className="acct-stat-val">{stats.awaitingPayment}</span><span className="acct-stat-label">{d.stats.unpaid}</span></div>
        <div className="acct-stat"><span className="acct-stat-val">{stats.inProgress}</span><span className="acct-stat-label">{d.stats.inProgress}</span></div>
        <div className="acct-stat"><span className="acct-stat-val">{stats.completed}</span><span className="acct-stat-label">{d.stats.completed}</span></div>
        <div className="acct-stat acct-stat-wide"><span className="acct-stat-val">{formatIDR(stats.transactionValue)}</span><span className="acct-stat-label">{d.stats.value}</span></div>
      </section>

      {alerts.length > 0 && (
        <section className="dash-alerts" aria-labelledby="customer-alert-title">
          <div className="acct-section-head">
            <h2 id="customer-alert-title" className="h3">{d.alerts.title}</h2>
          </div>
          {alerts.map((order) => {
            const { text, icon } = alertMessage(order);
            return (
              <Link key={order.number} href={`/dashboard/pesanan/${order.number}`} className="dash-alert">
                <Icon name={icon} size={19} />
                <span>{text}</span>
                <Icon name="chevronRight" size={17} />
              </Link>
            );
          })}
        </section>
      )}

      <section className="dash-block">
        <div className="acct-section-head">
          <h2 className="h3">{d.recent.title}</h2>
          <Link href="/dashboard/pesanan" className="link">{d.recent.all} <Icon name="arrow" /></Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title={d.recent.emptyTitle} body={d.recent.emptyBody} action={{ href: '/dashboard/katalog', label: d.recent.catalog }} />
        ) : (
          <div className="acct-order-list">
            {recent.map((order) => {
              const status = orderLabel(order.status);
              return (
                <Link key={order.number} href={`/dashboard/pesanan/${order.number}`} className="acct-order-row">
                  <div><span className="acct-order-no">{order.number}</span><span className="acct-order-date">{formatDate(order.date, lang)}</span></div>
                  <StatusBadge label={status[lang]} tone={status.tone} small />
                  <span className="acct-order-total">{formatIDR(order.grandTotal)}</span>
                  <Icon name="chevronRight" size={18} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="dash-block">
        <div className="acct-section-head"><h2 className="h3">{d.quick.title}</h2></div>
        <div className="dash-quick-grid">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="dash-quick-card">
              <Icon name={action.icon} size={22} />
              <span><strong>{action.label}</strong><small>{action.body}</small></span>
              <Icon name="chevronRight" size={17} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
