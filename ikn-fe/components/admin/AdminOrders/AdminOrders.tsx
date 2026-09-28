'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { Pager } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { orderLabel, orderStatus, paymentLabel } from '@/lib/commerce';
import { apiPaged, errorMessage } from '@/lib/api';
import { queryString } from '@/lib/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import type { PagedMeta } from '@/lib/cms';
import type { OrderStatusKey, OrderSummary } from '@/lib/types';

const STATUS_KEYS = Object.keys(orderStatus) as OrderStatusKey[];
const PER_PAGE = 20;

// Daftar order admin: GET /admin/orders?status&q&from&to&page&perPage (paginasi server).
export default function AdminOrders() {
  const router = useRouter();
  const params = useSearchParams();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const initialStatus = params.get('status') || '';
  const [status, setStatus] = useState<'' | OrderStatusKey>(STATUS_KEYS.includes(initialStatus as OrderStatusKey) ? (initialStatus as OrderStatusKey) : '');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OrderSummary[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiPaged<OrderSummary>(`/admin/orders${queryString({ status, q, from, to, page, perPage: PER_PAGE })}`)
      .then((result) => {
        if (cancelled) return;
        setRows(result.items);
        setMeta(result.meta);
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
  }, [status, q, from, to, page]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  function resetFilters() {
    setStatus('');
    setSearch('');
    setQ('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  const columns: Column<OrderSummary>[] = [
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
    {
      key: 'items',
      label: t('Item', 'Items'),
      align: 'right',
      render: (order) => String(order.itemsCount),
    },
    { key: 'total', label: 'Total', align: 'right', render: (order) => <strong>{formatIDR(order.grandTotal)}</strong> },
    {
      key: 'payment',
      label: t('Pembayaran', 'Payment'),
      render: (order) => (
        <StatusBadge label={paymentLabel(order.paymentStatus)[lang]} tone={paymentLabel(order.paymentStatus).tone} small />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (order) => <StatusBadge label={orderLabel(order.status)[lang]} tone={orderLabel(order.status).tone} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (order) => (
        <RowActions actions={[{ label: 'Detail', onClick: () => router.push(`/admin/orders/${encodeURIComponent(order.number)}`) }]} />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead title={t('Order', 'Orders')} desc={t('Kelola seluruh transaksi customer.', 'Manage all customer transactions.')} />

      <form className="admin-toolbar" onSubmit={submitSearch}>
        <label className="admin-search">
          <span className="sr-only">{t('Cari order', 'Search orders')}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Cari nomor order, invoice, atau customer', 'Search order number, invoice, or customer')}
          />
        </label>
        <button type="submit" className="btn btn-line btn-sm">
          {t('Cari', 'Search')}
        </button>
        <label className="admin-filter">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as '' | OrderStatusKey);
              setPage(1);
            }}
          >
            <option value="">{t('Semua status', 'All statuses')}</option>
            {STATUS_KEYS.map((key) => (
              <option key={key} value={key}>
                {orderStatus[key][lang]}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-filter">
          <span>{t('Dari', 'From')}</span>
          <input
            type="date"
            className="admin-filter-input"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="admin-filter">
          <span>{t('Sampai', 'To')}</span>
          <input
            type="date"
            className="admin-filter-input"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </label>
        {(status || q || from || to) && (
          <button type="button" className="row-act" onClick={resetFilters}>
            {t('Reset', 'Reset')}
          </button>
        )}
        <span className="admin-result-count">
          {meta.total} {t('order', 'orders')}
        </span>
      </form>

      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey="number"
        pagination={false}
        empty={loading ? t('Memuat order...', 'Loading orders...') : t('Belum ada order yang cocok.', 'No matching orders.')}
      />
      <Pager meta={meta} onPage={setPage} disabled={loading} />
    </div>
  );
}
