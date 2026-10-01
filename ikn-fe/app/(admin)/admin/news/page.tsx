'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column, type RowAction } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import { tr, type PostDetail, type PostSummary } from '@/lib/cms';
import { formatDate } from '@/lib/format';
import { formFromPost, toPayload } from './newsForm';
import { confirmDialog } from '@/components/ConfirmDialog';

// News list: GET /admin/news[?q=]. Writing happens in /admin/news/{id|new}.
export default function AdminNews() {
  const router = useRouter();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const q = query ? `?q=${encodeURIComponent(query)}` : '';
      setRows(await api<PostSummary[]>(`/admin/news${q}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function runSearch() {
    setLoading(true);
    setQuery(search.trim());
  }

  async function togglePublished(row: PostSummary) {
    setError('');
    try {
      const detail = await api<PostDetail>(`/admin/news/${row.id}`);
      await api(`/admin/news/${row.id}`, {
        method: 'PUT',
        body: toPayload({ ...formFromPost(detail), isPublished: !detail.isPublished }),
      });
      setNotice(detail.isPublished ? t('Berita dijadikan draf.', 'Post set to draft.') : t('Berita diterbitkan.', 'Post published.'));
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: PostSummary) {
    if (!await confirmDialog(t(`Hapus berita "${tr(row.title, lang)}"?`, `Delete post "${tr(row.title, lang)}"?`))) return;
    setError('');
    try {
      await api(`/admin/news/${row.id}`, { method: 'DELETE' });
      setNotice(t('Berita dihapus.', 'Post deleted.'));
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<PostSummary>[] = [
    {
      key: 'title',
      label: t('Judul', 'Title'),
      render: (n) => (
        <div className="cms-cell-media">
          {n.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.cover.url} alt="" className="cms-cell-thumb" />
          ) : (
            <span className="cms-cell-thumb" aria-hidden="true">
              —
            </span>
          )}
          <div>
            <strong>{tr(n.title, lang)}</strong>
            <small style={{ display: 'block', color: 'var(--ink-soft)', fontSize: '0.76rem' }} className="mono">
              /berita/{n.slug}
            </small>
          </div>
        </div>
      ),
    },
    { key: 'category', label: t('Kategori', 'Category'), render: (n) => (n.category ? tr(n.category.name, lang) : '—') },
    { key: 'author', label: t('Penulis', 'Author'), render: (n) => n.author || '—' },
    { key: 'publishedAt', label: t('Tanggal', 'Date'), render: (n) => formatDate(n.publishedAt, lang) },
    {
      key: 'isPublished',
      label: 'Status',
      render: (n) => (
        <StatusBadge label={n.isPublished ? t('Terbit', 'Published') : t('Draf', 'Draft')} tone={n.isPublished ? 'ok' : 'warn'} small />
      ),
    },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (n) => {
        const actions: RowAction[] = [{ label: 'Edit', onClick: () => router.push(`/admin/news/${n.id}`) }];
        if (n.isPublished) {
          actions.push({ label: t('Lihat', 'View'), onClick: () => window.open(`/berita/${n.slug}`, '_blank', 'noopener') });
          actions.push({ label: t('Jadikan draf', 'Unpublish'), tone: 'danger', onClick: () => void togglePublished(n) });
        } else {
          actions.push({ label: t('Terbitkan', 'Publish'), tone: 'success', onClick: () => void togglePublished(n) });
        }
        actions.push({ label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void remove(n) });
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Berita', 'News')}
        desc={t('Kelola berita dan artikel perusahaan.', 'Manage company news and articles.')}
        action={{ label: t('Tulis berita', 'Write post'), icon: 'plus', onClick: () => router.push('/admin/news/new') }}
      />

      <div className="admin-toolbar">
        <div className="admin-search">
          <input
            value={search}
            placeholder={t('Cari judul berita...', 'Search post title...')}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
              }
            }}
          />
        </div>
        <button type="button" className="btn btn-line btn-sm" onClick={runSearch}>
          {t('Cari', 'Search')}
        </button>
        {query && (
          <button
            type="button"
            className="row-act"
            onClick={() => {
              setSearch('');
              setLoading(true);
              setQuery('');
            }}
          >
            {t('Hapus filter', 'Clear')}
          </button>
        )}
        <span className="admin-result-count">
          {rows.length} {t('berita', 'posts')}
        </span>
      </div>

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        empty={
          loading
            ? t('Memuat berita...', 'Loading posts...')
            : query
              ? t('Tidak ada berita yang cocok.', 'No matching posts.')
              : t('Belum ada berita.', 'No posts yet.')
        }
      />
    </div>
  );
}
