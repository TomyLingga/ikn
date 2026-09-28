'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, MediaPicker, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type GalleryItemData, type I18n, type MediaSummary } from '@/lib/cms';

type GalleryType = GalleryItemData['type'];

interface GalleryForm {
  title: I18n;
  type: GalleryType;
  media: MediaSummary | null;
  externalUrl: string;
  isPublished: boolean;
  sortOrder: number;
}

const emptyForm = (): GalleryForm => ({
  title: emptyI18n(),
  type: 'image',
  media: null,
  externalUrl: '',
  isPublished: true,
  sortOrder: 0,
});

function formFromRow(row: GalleryItemData): GalleryForm {
  return {
    title: row.title,
    type: row.type,
    media: row.media,
    externalUrl: row.externalUrl ?? '',
    isPublished: row.isPublished,
    sortOrder: row.sortOrder,
  };
}

// GalleryItemRequest replaces every field on update, so always send the full record.
function toPayload(form: GalleryForm) {
  return {
    title: form.title,
    type: form.type,
    mediaId: form.type === 'image' ? form.media?.id ?? null : null,
    externalUrl: form.type === 'video' ? form.externalUrl.trim() || null : null,
    isPublished: form.isPublished,
    sortOrder: form.sortOrder,
  };
}

export default function AdminGallery() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<GalleryItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<GalleryForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<GalleryItemData[]>('/admin/gallery'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openForm(row: GalleryItemData | null) {
    setEditingId(row ? row.id : null);
    setForm(row ? formFromRow(row) : { ...emptyForm(), sortOrder: rows.length });
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    try {
      if (editingId) {
        await api(`/admin/gallery/${editingId}`, { method: 'PUT', body: toPayload(form) });
      } else {
        await api('/admin/gallery', { method: 'POST', body: toPayload(form) });
      }
      await refresh();
      closeForm();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormErrors(err.errors);
        setFormError(err.message);
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(row: GalleryItemData) {
    setError('');
    try {
      await api(`/admin/gallery/${row.id}`, {
        method: 'PUT',
        body: toPayload({ ...formFromRow(row), isPublished: !row.isPublished }),
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: GalleryItemData) {
    if (!window.confirm(t(`Hapus item galeri "${tr(row.title, lang)}"?`, `Delete gallery item "${tr(row.title, lang)}"?`))) return;
    setError('');
    try {
      await api(`/admin/gallery/${row.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<GalleryItemData>[] = [
    {
      key: 'title',
      label: t('Judul', 'Title'),
      render: (g) => (
        <div className="cms-cell-media">
          {g.type === 'image' && g.media ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.media.url} alt="" className="cms-cell-thumb" />
          ) : g.youtubeId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`https://img.youtube.com/vi/${g.youtubeId}/default.jpg`} alt="" className="cms-cell-thumb" />
          ) : null}
          <strong>{tr(g.title, lang)}</strong>
        </div>
      ),
    },
    { key: 'type', label: t('Tipe', 'Type'), render: (g) => (g.type === 'video' ? 'Video' : t('Gambar', 'Image')) },
    {
      key: 'source',
      label: t('Sumber', 'Source'),
      render: (g) => (
        <span className="mono">
          {g.type === 'video' ? g.youtubeId ? `youtu.be/${g.youtubeId}` : g.externalUrl || '—' : g.media?.originalName || '—'}
        </span>
      ),
    },
    { key: 'sortOrder', label: t('Urutan', 'Order'), align: 'right' },
    {
      key: 'isPublished',
      label: 'Status',
      render: (g) => (
        <StatusBadge label={g.isPublished ? t('Tampil', 'Visible') : t('Draf', 'Draft')} tone={g.isPublished ? 'ok' : 'warn'} small />
      ),
    },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (g) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(g) },
            g.isPublished
              ? { label: t('Sembunyikan', 'Hide'), tone: 'danger', onClick: () => void togglePublished(g) }
              : { label: t('Tampilkan', 'Show'), tone: 'success', onClick: () => void togglePublished(g) },
            { label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void remove(g) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Galeri Foto', 'Gallery')}
        desc={t('Kelola galeri foto dan video kegiatan serta fasilitas.', 'Manage photo and video gallery items.')}
        action={{ label: t('Tambah item', 'Add item'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable columns={columns} rows={rows} empty={loading ? t('Memuat galeri...', 'Loading gallery...') : t('Belum ada item galeri.', 'No gallery items yet.')} />

      {formOpen && (
        <AdminModal title={editingId ? t('Edit item galeri', 'Edit gallery item') : t('Tambah item galeri', 'Add gallery item')} onClose={closeForm}>
          <form className="admin-form" onSubmit={(event) => void submit(event)}>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <I18nInput
              label={t('Judul', 'Title')}
              value={form.title}
              onChange={(title) => setForm({ ...form, title })}
              required
              maxLength={200}
              errorId={firstError(formErrors, 'title.id', 'title')}
              errorEn={firstError(formErrors, 'title.en')}
            />
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Tipe', 'Type')}</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as GalleryType })}>
                  <option value="image">{t('Gambar', 'Image')}</option>
                  <option value="video">Video (YouTube)</option>
                </select>
              </label>
              <label>
                <span className="field-label">{t('Urutan', 'Sort order')}</span>
                <input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              </label>
            </div>
            {form.type === 'image' ? (
              <MediaPicker
                label={t('Gambar', 'Image')}
                value={form.media}
                onChange={(media) => setForm({ ...form, media })}
                accept="image"
                collection="gallery"
                required
                error={firstError(formErrors, 'mediaId')}
              />
            ) : (
              <label>
                <span className="field-label">{t('URL atau ID video YouTube', 'YouTube URL or video ID')}</span>
                <input
                  value={form.externalUrl}
                  onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
                  placeholder="https://youtu.be/dQw4w9WgXcQ"
                  maxLength={300}
                  required
                />
                {firstError(formErrors, 'externalUrl') && <small className="cms-field-error">{firstError(formErrors, 'externalUrl')}</small>}
              </label>
            )}
            <label className="cms-check">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              <span>{t('Tampilkan di situs', 'Show on site')}</span>
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : editingId ? t('Simpan perubahan', 'Save changes') : t('Tambah item', 'Add item')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
