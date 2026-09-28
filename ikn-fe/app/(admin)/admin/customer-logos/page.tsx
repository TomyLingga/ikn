'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { MediaPicker, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { CustomerLogoData, MediaSummary } from '@/lib/cms';

interface LogoForm {
  name: string;
  logo: MediaSummary | null;
  url: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm = (): LogoForm => ({ name: '', logo: null, url: '', isActive: true, sortOrder: 0 });

function formFromRow(row: CustomerLogoData): LogoForm {
  return { name: row.name, logo: row.logo, url: row.url ?? '', isActive: row.isActive, sortOrder: row.sortOrder };
}

// CustomerLogoRequest replaces every field on update, so always send the full record.
function toPayload(form: LogoForm) {
  return {
    name: form.name.trim(),
    mediaId: form.logo?.id ?? null,
    url: form.url.trim() || null,
    isActive: form.isActive,
    sortOrder: form.sortOrder,
  };
}

export default function AdminCustomerLogos() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<CustomerLogoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LogoForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<CustomerLogoData[]>('/admin/customer-logos'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openForm(row: CustomerLogoData | null) {
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
        await api(`/admin/customer-logos/${editingId}`, { method: 'PUT', body: toPayload(form) });
      } else {
        await api('/admin/customer-logos', { method: 'POST', body: toPayload(form) });
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

  async function toggleActive(row: CustomerLogoData) {
    setError('');
    try {
      await api(`/admin/customer-logos/${row.id}`, {
        method: 'PUT',
        body: toPayload({ ...formFromRow(row), isActive: !row.isActive }),
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: CustomerLogoData) {
    if (!window.confirm(t(`Hapus logo "${row.name}"?`, `Delete logo "${row.name}"?`))) return;
    setError('');
    try {
      await api(`/admin/customer-logos/${row.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<CustomerLogoData>[] = [
    {
      key: 'name',
      label: t('Pelanggan', 'Customer'),
      render: (c) => (
        <div className="cms-cell-media">
          {c.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logo.url} alt="" className="cms-cell-thumb cms-cell-thumb-contain" />
          ) : (
            <span className="cms-cell-thumb cms-cell-thumb-empty mono">{c.name.slice(0, 2).toUpperCase()}</span>
          )}
          <strong>{c.name}</strong>
        </div>
      ),
    },
    {
      key: 'url',
      label: t('Tautan', 'Link'),
      render: (c) =>
        c.url ? (
          <a href={c.url} target="_blank" rel="noopener noreferrer" className="cms-link mono">
            {c.url}
          </a>
        ) : (
          '—'
        ),
    },
    { key: 'sortOrder', label: t('Urutan', 'Order'), align: 'right' },
    {
      key: 'isActive',
      label: 'Status',
      render: (c) => <StatusBadge label={c.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={c.isActive ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (c) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(c) },
            c.isActive
              ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', onClick: () => void toggleActive(c) }
              : { label: t('Aktifkan', 'Activate'), tone: 'success', onClick: () => void toggleActive(c) },
            { label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void remove(c) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Logo Pelanggan', 'Customer Logos')}
        desc={t('Logo pelanggan yang tampil di halaman Pelanggan Kami.', 'Customer logos shown on the Our Customers page.')}
        action={{ label: t('Tambah logo', 'Add logo'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable columns={columns} rows={rows} empty={loading ? t('Memuat logo...', 'Loading logos...') : t('Belum ada logo pelanggan.', 'No customer logos yet.')} />

      {formOpen && (
        <AdminModal title={editingId ? t('Edit logo pelanggan', 'Edit customer logo') : t('Tambah logo pelanggan', 'Add customer logo')} onClose={closeForm}>
          <form className="admin-form" onSubmit={(event) => void submit(event)}>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <label>
              <span className="field-label">{t('Nama pelanggan', 'Customer name')}</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />
              {firstError(formErrors, 'name') && <small className="cms-field-error">{firstError(formErrors, 'name')}</small>}
            </label>
            <MediaPicker
              label={t('Logo (opsional)', 'Logo (optional)')}
              value={form.logo}
              onChange={(logo) => setForm({ ...form, logo })}
              accept="image"
              collection="logos"
              hint={t('Tanpa logo, nama pelanggan ditampilkan sebagai teks.', 'Without a logo the customer name is shown as text.')}
              error={firstError(formErrors, 'mediaId')}
            />
            <label>
              <span className="field-label">{t('Tautan situs (opsional)', 'Website link (optional)')}</span>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." maxLength={500} />
              {firstError(formErrors, 'url') && <small className="cms-field-error">{firstError(formErrors, 'url')}</small>}
            </label>
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Urutan', 'Sort order')}</span>
                <input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              </label>
              <label className="cms-check" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span>{t('Aktif', 'Active')}</span>
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : editingId ? t('Simpan perubahan', 'Save changes') : t('Tambah logo', 'Add logo')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
