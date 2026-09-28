'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { Pager } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, apiPaged, errorMessage } from '@/lib/api';
import { tr, type PagedMeta } from '@/lib/cms';
import { queryString } from '@/lib/admin';
import { formatDateTime } from '@/lib/format';
import type { ProductReview } from '@/lib/types';

const PER_PAGE = 20;

// Moderasi ulasan: GET /admin/reviews?q&product&published&page, PUT /admin/reviews/{id} { isPublished }.
export default function AdminReviews() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<ProductReview[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [published, setPublished] = useState('');
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiPaged<ProductReview>(`/admin/reviews${queryString({ q, published, page, perPage: PER_PAGE })}`);
      setRows(result.items);
      setMeta(result.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [q, published, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  async function setVisible(review: ProductReview, isPublished: boolean) {
    setBusyId(review.id);
    setError('');
    try {
      await api(`/admin/reviews/${review.id}`, { method: 'PUT', body: { isPublished } });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const stars = (rating: number) => '★'.repeat(Math.max(0, Math.min(5, rating))) + '☆'.repeat(Math.max(0, 5 - rating));

  const columns: Column<ProductReview>[] = [
    {
      key: 'product',
      label: t('Produk', 'Product'),
      render: (r) => (
        <span>
          {r.productSlug ? (
            <Link href={`/catalog/${r.productSlug}`} className="link" target="_blank">
              {tr(r.productName, lang) || r.productSlug}
            </Link>
          ) : (
            tr(r.productName, lang) || `#${r.productId}`
          )}
          {r.orderId && <small className="admin-cell-sub mono">order #{r.orderId}</small>}
        </span>
      ),
    },
    { key: 'customer', label: 'Customer', render: (r) => r.customer || `#${r.userId}` },
    {
      key: 'rating',
      label: 'Rating',
      render: (r) => (
        <span className="admin-stars" title={`${r.rating}/5`}>
          {stars(r.rating)}
        </span>
      ),
    },
    { key: 'body', label: t('Ulasan', 'Review'), render: (r) => <span className="admin-cell-wrap">{r.body || '—'}</span> },
    { key: 'date', label: t('Tanggal', 'Date'), render: (r) => formatDateTime(r.createdAt || r.date, lang) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge label={r.isPublished ? t('Tampil', 'Visible') : t('Disembunyikan', 'Hidden')} tone={r.isPublished ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (r) => (
        <RowActions
          actions={[
            r.isPublished
              ? { label: t('Sembunyikan', 'Hide'), tone: 'danger', disabled: busyId === r.id, onClick: () => void setVisible(r, false) }
              : { label: t('Tampilkan', 'Show'), tone: 'success', disabled: busyId === r.id, onClick: () => void setVisible(r, true) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Ulasan Produk', 'Product Reviews')}
        desc={t('Ulasan customer dari order selesai. Menyembunyikan ulasan otomatis menghitung ulang rating produk.', 'Customer reviews from completed orders. Hiding a review recalculates the product rating automatically.')}
      />

      {error && <p className="form-error">{error}</p>}

      <form className="admin-toolbar" onSubmit={submitSearch}>
        <label className="admin-search">
          <span className="sr-only">{t('Cari ulasan', 'Search reviews')}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Cari isi ulasan, customer, atau produk', 'Search review text, customer, or product')} />
        </label>
        <button type="submit" className="btn btn-line btn-sm">
          {t('Cari', 'Search')}
        </button>
        <label className="admin-filter">
          <span>Status</span>
          <select
            value={published}
            onChange={(e) => {
              setPublished(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('Semua', 'All')}</option>
            <option value="1">{t('Tampil', 'Visible')}</option>
            <option value="0">{t('Disembunyikan', 'Hidden')}</option>
          </select>
        </label>
        <span className="admin-result-count">
          {meta.total} {t('ulasan', 'reviews')}
        </span>
      </form>

      <DataTable columns={columns} rows={rows} pagination={false} empty={loading ? t('Memuat ulasan...', 'Loading reviews...') : t('Belum ada ulasan.', 'No reviews yet.')} />
      <Pager meta={meta} onPage={setPage} disabled={loading} />
    </div>
  );
}
