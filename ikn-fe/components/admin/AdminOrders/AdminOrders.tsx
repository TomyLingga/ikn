'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderStatus, paymentStatus } from '@/lib/commerce';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatIDR } from '@/lib/format';
import type { Order, OrderStatusKey } from '@/lib/types';

export default function AdminOrders() {
  const router = useRouter();
  const { lang } = useLang();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatusKey>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    api<Order[]>(`/admin/orders${query}`)
      .then((result) => {
        if (!cancelled) setOrders(result);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const columns: Column<Order>[] = [
    {
      key: 'number',
      label: lang === 'en' ? 'Order No.' : 'No. Order',
      render: (order) => (
        <Link href={`/admin/orders/${order.number}`} className="mono link">{order.number}</Link>
      ),
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
    {
      key: 'act',
      label: lang === 'en' ? 'Action' : 'Aksi',
      render: (order) => (
        <RowActions
          actions={[{ label: lang === 'en' ? 'Detail' : 'Detail', onClick: () => router.push(`/admin/orders/${order.number}`) }]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={lang === 'en' ? 'Orders' : 'Order'}
        desc={lang === 'en' ? 'Manage all customer transactions.' : 'Kelola seluruh transaksi customer.'}
      />

      <div className="admin-toolbar">
        <label className="admin-filter">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderStatusKey)}
          >
            <option value="all">{lang === 'en' ? 'All status' : 'Semua status'}</option>
            {(Object.keys(orderStatus) as OrderStatusKey[]).map((key) => (
              <option key={key} value={key}>
                {orderStatus[key]?.[lang] || orderStatus[key]?.id}
              </option>
            ))}
          </select>
        </label>
        <span className="admin-result-count">
          {orders.length} {lang === 'en' ? 'orders' : 'order'}
        </span>
      </div>

      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={orders}
        empty={
          loading
            ? lang === 'en' ? 'Loading orders...' : 'Memuat order...'
            : lang === 'en' ? 'No orders found.' : 'Belum ada order.'
        }
      />
    </div>
  );
}
