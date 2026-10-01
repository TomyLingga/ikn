'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import AdminTabs, { type AdminTab, type AdminTabGroup } from '@/components/admin/AdminTabs';
import { Pager } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { orderLabel, orderStatus, paymentLabel } from '@/lib/commerce';
import { apiPaged, errorMessage } from '@/lib/api';
import { defaultDateRange, queryString, type CountsMeta } from '@/lib/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import type { IconName, OrderStatusKey, OrderSummary } from '@/lib/types';

const STATUS_KEYS = Object.keys(orderStatus) as OrderStatusKey[];
// Tab bawaan: antrean verifikasi pembayaran. Status yang menunggu tindakan admin memakai lencana merah.
const DEFAULT_STATUS: OrderStatusKey = 'payment_review';
const WORK_STATUSES: OrderStatusKey[] = ['payment_review', 'paid', 'processing', 'shipped', 'delivered'];
// Antrean (tanpa filter tanggal: semua order yang masih berjalan tampil) vs riwayat (dengan rentang tanggal).
const QUEUE_STATUSES: OrderStatusKey[] = ['pending_payment', 'payment_review', 'paid', 'processing', 'shipped', 'delivered'];
const HISTORY_STATUSES: StatusFilter[] = ['', 'completed', 'cancelled', 'expired'];
const TAB_ICONS: Partial<Record<OrderStatusKey, IconName>> = {
  pending_payment: 'clock',
  payment_review: 'paymentCheck',
  paid: 'wallet',
  processing: 'package',
  shipped: 'truck',
  delivered: 'checkCircle',
  completed: 'check',
  cancelled: 'cancelCircle',
  expired: 'close',
};
const PER_PAGE = 20;

type StatusFilter = '' | OrderStatusKey; // '' = semua status

// Daftar order admin: GET /admin/orders?status&q&from&to&page&perPage (paginasi server); tab status dengan angka
// dari meta.counts, dikelompokkan "Perlu diproses" (tanpa filter tanggal) dan "Riwayat" (Semua, Selesai, Dibatalkan,
// Kedaluwarsa; rentang order dibuat bawaan awal bulan s.d. hari ini, dengan catatan "tampilkan semua tanggal" bila ada
// order di luar rentang). Datang dengan ?status= memakai status itu; ?q= saja mencari di semua status dan tanggal.
export default function AdminOrders() {
  const router = useRouter();
  const params = useSearchParams();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const paramStatus = params.get('status');
  const paramQuery = params.get('q') || '';
  const initialStatus: StatusFilter = STATUS_KEYS.includes(paramStatus as OrderStatusKey)
    ? (paramStatus as OrderStatusKey)
    : paramStatus === 'all' || paramQuery
      ? ''
      : DEFAULT_STATUS;
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [search, setSearch] = useState(paramQuery);
  const [q, setQ] = useState(paramQuery);
  const [range, setRange] = useState(() => (paramQuery ? { from: '', to: '' } : defaultDateRange()));
  const dated = HISTORY_STATUSES.includes(status);
  const from = dated ? range.from : '';
  const to = dated ? range.to : '';
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OrderSummary[]>([]);
  const [meta, setMeta] = useState<CountsMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
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
        setMeta(result.meta as CountsMeta);
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
    setStatus(DEFAULT_STATUS);
    setSearch('');
    setQ('');
    setRange(defaultDateRange());
    setPage(1);
  }

  const defaults = defaultDateRange();
  const filtersChanged = status !== DEFAULT_STATUS || !!q || (dated && (range.from !== defaults.from || range.to !== defaults.to));
  const counts = meta.counts || {};
  const allCount = STATUS_KEYS.reduce((sum, key) => sum + (counts[key] || 0), 0);
  const tabFor = (key: StatusFilter): AdminTab<StatusFilter> =>
    key === ''
      ? { key, label: t('Semua', 'All'), icon: 'orders', count: allCount }
      : { key, label: orderStatus[key][lang], icon: TAB_ICONS[key], count: counts[key] || 0, badge: WORK_STATUSES.includes(key) };
  const groups: AdminTabGroup<StatusFilter>[] = [
    { key: 'queue', label: t('Perlu diproses', 'In progress'), note: t('semua tanggal', 'all dates'), tabs: QUEUE_STATUSES.map(tabFor) },
    { key: 'history', label: t('Riwayat', 'History'), note: t('filter tanggal', 'date filter'), tabs: HISTORY_STATUSES.map(tabFor) },
  ];
  // Jumlah tab = sepanjang waktu; bila daftar (dengan rentang tanggal, tanpa pencarian) lebih sedikit, ada order di luar rentang.
  const tabTotal = status === '' ? allCount : counts[status] || 0;
  const outsideRange = !q && (from || to) ? Math.max(0, tabTotal - meta.total) : 0;

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

      <AdminTabs
        groups={groups}
        value={status}
        label={t('Status order', 'Order status')}
        onChange={(key) => {
          setStatus(key);
          setPage(1);
        }}
      />

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
        {dated && (
          <>
            <label className="admin-filter">
              <span>{t('Dari', 'From')}</span>
              <input
                type="date"
                className="admin-filter-input"
                value={range.from}
                max={range.to || undefined}
                onChange={(event) => {
                  setRange({ ...range, from: event.target.value });
                  setPage(1);
                }}
              />
            </label>
            <label className="admin-filter">
              <span>{t('Sampai', 'To')}</span>
              <input
                type="date"
                className="admin-filter-input"
                value={range.to}
                min={range.from || undefined}
                onChange={(event) => {
                  setRange({ ...range, to: event.target.value });
                  setPage(1);
                }}
              />
            </label>
          </>
        )}
        {filtersChanged && (
          <button type="button" className="row-act" onClick={resetFilters}>
            {t('Reset', 'Reset')}
          </button>
        )}
        <span className="admin-result-count">
          {meta.total} {t('order', 'orders')}
        </span>
      </form>
      <p className="admin-field-hint admin-filter-note">
        {!dated
          ? t('Antrean ini menampilkan semua order pada status tersebut tanpa batas tanggal.', 'This queue shows every order in this status, with no date limit.')
          : from || to
            ? t('Tanggal = order dibuat.', 'Date = order created.')
            : t('Semua tanggal.', 'All dates.')}
        {outsideRange > 0 && (
          <>
            {' '}
            {t(`${outsideRange} order lain berada di luar rentang tanggal.`, `${outsideRange} more order(s) fall outside the date range.`)}
            <button type="button" onClick={() => { setRange({ from: '', to: '' }); setPage(1); }}>
              {t('Tampilkan semua tanggal', 'Show all dates')}
            </button>
          </>
        )}
      </p>

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
