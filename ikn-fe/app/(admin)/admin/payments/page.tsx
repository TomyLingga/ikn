'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { paymentStatus } from '@/lib/commerce';
import { api, errorMessage } from '@/lib/api';
import { formatIDR, formatDate } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function AdminPayments() {
  const { lang } = useLang();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api<Order[]>('/admin/payments');
      setOrders(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function acceptPayment(number: string) {
    void run(() => api(`/admin/payments/${encodeURIComponent(number)}/accept`, { method: 'POST', body: {} }));
  }

  function rejectPayment(number: string) {
    const reason = window.prompt(
      lang === 'en'
        ? `Reason for rejecting payment ${number} (required):`
        : `Alasan penolakan pembayaran ${number} (wajib):`
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setError(lang === 'en' ? 'Rejection reason is required.' : 'Alasan penolakan wajib diisi.');
      return;
    }
    void run(() =>
      api(`/admin/payments/${encodeURIComponent(number)}/reject`, {
        method: 'POST',
        body: { reason: reason.trim() },
      })
    );
  }

  const columns: Column<Order>[] = [
    { key: 'no', label: 'No', render: (_order, index) => index + 1 },
    {
      key: 'invoice',
      label: 'Invoice',
      render: (order) => (
        <Link href={`/admin/orders/${order.number}`} className="mono link">INV-{order.number}</Link>
      ),
    },
    { key: 'customer', label: 'Customer', render: (order) => order.customer.name },
    {
      key: 'method',
      label: lang === 'en' ? 'Method' : 'Metode',
      render: (order) => `Transfer${order.bankInfo ? ` · ${order.bankInfo.bank}` : ''}`,
    },
    { key: 'total', label: lang === 'en' ? 'Amount' : 'Nominal', align: 'right', render: (order) => formatIDR(order.total) },
    {
      key: 'payment',
      label: 'Status',
      render: (order) => (
        <StatusBadge
          label={paymentStatus[order.payment]?.[lang] || paymentStatus[order.payment]?.id || order.payment}
          tone={paymentStatus[order.payment]?.tone}
          small
        />
      ),
    },
    { key: 'date', label: lang === 'en' ? 'Date' : 'Tanggal', render: (order) => formatDate(order.date) },
    {
      key: 'proof',
      label: lang === 'en' ? 'Proof' : 'Bukti',
      render: (order) =>
        order.proof ? (
          <a
            href={`/api/admin/payments/${encodeURIComponent(order.number)}/proof/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="link"
          >
            {lang === 'en' ? 'View proof' : 'Lihat bukti'}
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'act',
      label: lang === 'en' ? 'Action' : 'Aksi',
      render: (order) =>
        order.payment === 'awaiting_confirmation' ? (
          <RowActions
            actions={[
              { label: lang === 'en' ? 'Verify' : 'Verifikasi', tone: 'success', disabled: busy, onClick: () => acceptPayment(order.number) },
              { label: lang === 'en' ? 'Reject' : 'Tolak', tone: 'danger', disabled: busy, onClick: () => rejectPayment(order.number) },
            ]}
          />
        ) : (
          <span className="admin-note">—</span>
        ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title="Payment"
        desc={
          lang === 'en'
            ? 'Verify transfer proofs and order payment statuses.'
            : 'Verifikasi bukti transfer dan status pembayaran order.'
        }
      />
      {error && <p className="form-error">{error}</p>}
      <DataTable
        columns={columns}
        rows={orders}
        rowKey="number"
        empty={
          loading
            ? lang === 'en' ? 'Loading payments...' : 'Memuat pembayaran...'
            : lang === 'en' ? 'No payments found.' : 'Belum ada pembayaran.'
        }
      />
    </div>
  );
}
