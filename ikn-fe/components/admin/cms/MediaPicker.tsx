'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import AdminModal from '@/components/admin/AdminModal';
import { useLang } from '@/components/LanguageProvider';
import { apiPaged, errorMessage, uploadMedia } from '@/lib/api';
import type { MediaItem, MediaSummary, PagedMeta } from '@/lib/cms';
import MediaGrid, { formatBytes, isImageMedia } from './MediaGrid';
import Pager from './Pager';
import { mediaId, mediaSummary, type MediaValue } from './schema';

export type MediaKind = 'image' | 'document';

const ACCEPT_ATTR: Record<MediaKind, string> = {
  image: 'image/*',
  document: '.pdf,application/pdf',
};

// Media field: shows the current file, uploads a new one, or picks from the library.
// `value` may be a hydrated summary, `{ id }`, a raw id, or null; onChange gives the summary.
interface MediaPickerProps {
  label?: string;
  value: MediaValue;
  onChange: (media: MediaSummary | null) => void;
  accept?: MediaKind;
  collection?: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

export default function MediaPicker({
  label,
  value,
  onChange,
  accept = 'image',
  collection = 'general',
  error,
  required = false,
  hint,
}: MediaPickerProps) {
  const { lang } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [localError, setLocalError] = useState('');
  const id = mediaId(value);
  const summary = mediaSummary(value);
  const t = (idText: string, en: string) => (lang === 'en' ? en : idText);

  async function handleFile(file: File) {
    setUploading(true);
    setLocalError('');
    try {
      onChange(await uploadMedia(file, collection));
    } catch (err) {
      setLocalError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  let preview: ReactNode;
  if (summary && isImageMedia(summary)) {
    // eslint-disable-next-line @next/next/no-img-element
    preview = <img className="admin-image-preview" src={summary.url} alt={summary.originalName} />;
  } else if (id) {
    preview = (
      <div className="admin-image-placeholder">
        <Icon name="quote" size={22} />
        <span>{summary ? summary.originalName : `#${id}`}</span>
      </div>
    );
  } else {
    preview = (
      <div className="admin-image-placeholder">
        <Icon name="image" size={22} />
        <span>{t('Belum ada berkas', 'No file yet')}</span>
      </div>
    );
  }

  const shownError = error || localError;

  return (
    <div className="cms-field">
      {label && (
        <span className="field-label">
          {label}
          {required && <span className="cms-req">*</span>}
        </span>
      )}
      <div className="admin-image-box">
        <div className="admin-image-preview-wrap">{preview}</div>
        <div className="admin-image-actions">
          {summary ? (
            <p className="admin-field-hint">
              <a href={summary.url} target="_blank" rel="noopener noreferrer" className="cms-link">
                {summary.originalName}
              </a>{' '}
              · {formatBytes(summary.size)} · #{summary.id}
            </p>
          ) : id ? (
            <p className="admin-field-hint">Media #{id}</p>
          ) : hint ? (
            <p className="admin-field-hint">{hint}</p>
          ) : null}
          <div className="admin-image-buttons">
            <button
              type="button"
              className="btn btn-line btn-sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? t('Mengunggah...', 'Uploading...') : t('Unggah', 'Upload')}
            </button>
            <button type="button" className="btn btn-line btn-sm" onClick={() => setLibraryOpen(true)}>
              {t('Pilih dari media', 'Choose from library')}
            </button>
            {id && (
              <button type="button" className="row-act row-act-danger" onClick={() => onChange(null)}>
                {t('Hapus', 'Remove')}
              </button>
            )}
          </div>
          {shownError && <small className="cms-field-error">{shownError}</small>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR[accept]}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      {libraryOpen && (
        <MediaLibraryModal
          accept={accept}
          selectedId={id}
          onClose={() => setLibraryOpen(false)}
          onPick={(media) => {
            onChange(media);
            setLibraryOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Paginated library grid (GET /admin/media?type=&perPage=60&page=).
interface MediaLibraryModalProps {
  accept: MediaKind;
  selectedId: number | null;
  onPick: (media: MediaItem) => void;
  onClose: () => void;
}

export function MediaLibraryModal({ accept, selectedId, onPick, onClose }: MediaLibraryModalProps) {
  const { lang } = useLang();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: 60, total: 0, lastPage: 1 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const t = (idText: string, en: string) => (lang === 'en' ? en : idText);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const q = query ? `&q=${encodeURIComponent(query)}` : '';
    apiPaged<MediaItem>(`/admin/media?type=${accept}&perPage=60&page=${page}${q}`)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setMeta(result.meta);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accept, page, query]);

  function runSearch() {
    setPage(1);
    setQuery(search.trim());
  }

  return (
    <AdminModal title={t('Pilih dari media', 'Choose from media library')} onClose={onClose} width={960}>
      <div className="media-modal-body">
        <div className="admin-toolbar" style={{ marginBottom: 0 }}>
          <div className="admin-search">
            <input
              value={search}
              placeholder={t('Cari nama berkas...', 'Search file name...')}
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
          <span className="admin-result-count">
            {meta.total} {t('berkas', 'files')}
          </span>
        </div>
        {error && <p className="form-error">{error}</p>}
        {loading ? (
          <div className="admin-empty">{t('Memuat media...', 'Loading media...')}</div>
        ) : (
          <MediaGrid
            items={items}
            selectedId={selectedId}
            onSelect={onPick}
            empty={t('Belum ada media yang cocok.', 'No matching media.')}
          />
        )}
        <Pager meta={meta} onPage={setPage} disabled={loading} />
      </div>
    </AdminModal>
  );
}
