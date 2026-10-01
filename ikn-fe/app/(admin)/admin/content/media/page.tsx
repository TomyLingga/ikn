'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminCard, AdminPageHead } from '@/components/admin/AdminPage';
import FileUploadDropzone from '@/components/admin/FileUploadDropzone/FileUploadDropzone';
import { MediaGrid, Pager } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, apiPaged, ApiError, errorMessage, uploadMedia } from '@/lib/api';
import type { MediaItem, PagedMeta } from '@/lib/cms';
import { confirmDialog } from '@/components/ConfirmDialog';

type MediaFilter = '' | 'image' | 'document';

// Media library: paginated grid of uploaded files (GET /admin/media), upload, delete, copy URL.
export default function AdminMediaLibrary() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [filter, setFilter] = useState<MediaFilter>('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: 30, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = query ? `&q=${encodeURIComponent(query)}` : '';
      const result = await apiPaged<MediaItem>(`/admin/media?type=${filter}&page=${page}&perPage=30${q}`);
      setItems(result.items);
      setMeta(result.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filter, page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      const collection = file.type.startsWith('image/') ? 'general' : 'documents';
      const media = await uploadMedia(file, collection);
      setNotice(`${media.originalName} ${t('berhasil diunggah.', 'uploaded successfully.')}`);
      if (page !== 1) setPage(1);
      else await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function remove(item: MediaItem) {
    if (!await confirmDialog(t(`Hapus berkas "${item.originalName}"?`, `Delete file "${item.originalName}"?`))) return;
    setError('');
    try {
      await api(`/admin/media/${item.id}`, { method: 'DELETE' });
      setNotice(t('Berkas dihapus.', 'File deleted.'));
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'MEDIA_IN_USE') {
        setError(
          `${err.message} ${t(
            'Lepaskan berkas dari halaman/berita/galeri yang memakainya sebelum menghapus.',
            'Detach the file from the pages/posts/gallery items that use it before deleting.',
          )}`,
        );
      } else {
        setError(errorMessage(err));
      }
    }
  }

  async function copyUrl(item: MediaItem) {
    try {
      await navigator.clipboard.writeText(item.url);
      setNotice(t('URL disalin ke clipboard.', 'URL copied to clipboard.'));
    } catch {
      setError(t('Tidak dapat menyalin URL. Salin manual dari tombol Buka.', 'Could not copy the URL. Copy it manually from the Open button.'));
    }
  }

  const filters: Array<{ value: MediaFilter; label: string }> = [
    { value: '', label: t('Semua', 'All') },
    { value: 'image', label: t('Gambar', 'Images') },
    { value: 'document', label: t('Dokumen', 'Documents') },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Video & Gambar', 'Media Library')}
        desc={t(
          'Semua berkas yang dipakai halaman, berita, galeri, sertifikat, dan brosur.',
          'All files used by pages, posts, gallery, certificates, and brochures.',
        )}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <div style={{ marginBottom: 22 }}>
        <AdminCard title={t('Unggah berkas baru', 'Upload a new file')}>
          <FileUploadDropzone
            label=""
            accept="image/*,.pdf,application/pdf"
            selectedFile={null}
            onFileSelect={(file) => {
              if (file && !uploading) void upload(file);
            }}
            helperText={
              uploading
                ? t('Mengunggah...', 'Uploading...')
                : t('Gambar (JPG, PNG, WebP, GIF, SVG) atau dokumen PDF.', 'Images (JPG, PNG, WebP, GIF, SVG) or PDF documents.')
            }
          />
        </AdminCard>
      </div>

      <div className="admin-toolbar">
        <div className="filter-pill-group" style={{ marginBottom: 0 }}>
          {filters.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              className={`filter-pill${filter === f.value ? ' is-active' : ''}`}
              onClick={() => {
                setFilter(f.value);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="admin-search">
          <input
            value={search}
            placeholder={t('Cari nama berkas...', 'Search file name...')}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setQuery(search.trim());
              }
            }}
          />
        </div>
        <span className="admin-result-count">
          {meta.total} {t('berkas', 'files')}
        </span>
      </div>

      {loading ? (
        <div className="admin-empty">{t('Memuat media...', 'Loading media...')}</div>
      ) : (
        <MediaGrid
          items={items}
          empty={t('Belum ada berkas.', 'No files yet.')}
          actions={(item) => (
            <>
              <button type="button" className="row-act" onClick={() => void copyUrl(item)}>
                {t('Salin URL', 'Copy URL')}
              </button>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="row-act">
                {t('Buka', 'Open')}
              </a>
              <button type="button" className="row-act row-act-danger" onClick={() => void remove(item)}>
                {t('Hapus', 'Delete')}
              </button>
            </>
          )}
        />
      )}

      <Pager meta={meta} onPage={setPage} disabled={loading} />
    </div>
  );
}
