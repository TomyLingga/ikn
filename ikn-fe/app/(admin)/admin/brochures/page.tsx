'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, MediaPicker, firstError, formatBytes, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type BrochureData, type I18n, type MediaSummary } from '@/lib/cms';

interface BrochureForm {
  title: I18n;
  description: I18n;
  file: MediaSummary | null;
  isPublished: boolean;
  sortOrder: number;
}

const emptyForm = (): BrochureForm => ({
  title: emptyI18n(),
  description: emptyI18n(),
  file: null,
  isPublished: true,
  sortOrder: 0,
});

function formFromRow(row: BrochureData): BrochureForm {
  return {
    title: row.title,
    description: row.description ?? emptyI18n(),
    file: row.file,
    isPublished: row.isPublished,
    sortOrder: row.sortOrder,
  };
}

// BrochureRequest replaces every field on update, so always send the full record.
function toPayload(form: BrochureForm) {
  return {
    title: form.title,
    description: form.description,
    mediaId: form.file?.id ?? null,
    isPublished: form.isPublished,
    sortOrder: form.sortOrder,
  };
}

export default function AdminBrochures() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<BrochureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BrochureForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<BrochureData[]>('/admin/brochures'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openForm(row: BrochureData | null) {
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
        await api(`/admin/brochures/${editingId}`, { method: 'PUT', body: toPayload(form) });
      } else {
        await api('/admin/brochures', { method: 'POST', body: toPayload(form) });
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

  async function togglePublished(row: BrochureData) {
    setError('');
    try {
      await api(`/admin/brochures/${row.id}`, {
        method: 'PUT',
        body: toPayload({ ...formFromRow(row), isPublished: !row.isPublished }),
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: BrochureData) {
    if (!window.confirm(t(`Hapus brosur "${tr(row.title, lang)}"?`, `Delete brochure "${tr(row.title, lang)}"?`))) return;
    setError('');
    try {
      await api(`/admin/brochures/${row.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<BrochureData>[] = [
    { key: 'title', label: t('Judul', 'Title'), render: (b) => <strong>{tr(b.title, lang)}</strong> },
    {
      key: 'file',
      label: t('Berkas', 'File'),
      render: (b) =>
        b.file ? (
          <a href={b.file.url} target="_blank" rel="noopener noreferrer" className="cms-link mono">
            {b.file.originalName}
          </a>
        ) : (
          '—'
        ),
    },
    { key: 'size', label: t('Ukuran', 'Size'), align: 'right', render: (b) => (b.file ? formatBytes(b.file.size) : '—') },
    { key: 'sortOrder', label: t('Urutan', 'Order'), align: 'right' },
    {
      key: 'isPublished',
      label: 'Status',
      render: (b) => (
        <StatusBadge label={b.isPublished ? t('Tampil', 'Visible') : t('Draf', 'Draft')} tone={b.isPublished ? 'ok' : 'warn'} small />
      ),
    },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (b) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(b) },
            b.isPublished
              ? { label: t('Sembunyikan', 'Hide'), tone: 'danger', onClick: () => void togglePublished(b) }
              : { label: t('Tampilkan', 'Show'), tone: 'success', onClick: () => void togglePublished(b) },
            { label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void remove(b) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Brosur Unduhan', 'Brochures')}
        desc={t('Kelola brosur produk yang dapat diunduh pengunjung.', 'Manage downloadable product brochures.')}
        action={{ label: t('Tambah brosur', 'Add brochure'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable columns={columns} rows={rows} empty={loading ? t('Memuat brosur...', 'Loading brochures...') : t('Belum ada brosur.', 'No brochures yet.')} />

      {formOpen && (
        <AdminModal title={editingId ? t('Edit brosur', 'Edit brochure') : t('Tambah brosur', 'Add brochure')} onClose={closeForm} width={880}>
          <form className="admin-form" onSubmit={(event) => void submit(event)}>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <I18nInput
              label={t('Judul brosur', 'Brochure title')}
              value={form.title}
              onChange={(title) => setForm({ ...form, title })}
              required
              maxLength={200}
              errorId={firstError(formErrors, 'title.id', 'title')}
              errorEn={firstError(formErrors, 'title.en')}
            />
            <I18nInput
              label={t('Deskripsi', 'Description')}
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
              multiline
              rows={3}
              maxLength={1000}
              errorId={firstError(formErrors, 'description.id')}
              errorEn={firstError(formErrors, 'description.en')}
            />
            <MediaPicker
              label={t('Berkas brosur (PDF)', 'Brochure file (PDF)')}
              value={form.file}
              onChange={(file) => setForm({ ...form, file })}
              accept="document"
              collection="brochures"
              error={firstError(formErrors, 'mediaId')}
            />
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Urutan', 'Sort order')}</span>
                <input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              </label>
              <label className="cms-check" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                <span>{t('Tampilkan di situs', 'Show on site')}</span>
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : editingId ? t('Simpan perubahan', 'Save changes') : t('Tambah brosur', 'Add brochure')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
