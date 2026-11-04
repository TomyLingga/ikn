'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, MediaPicker, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type CertificateData, type CertificateStatus, type I18n, type MediaSummary } from '@/lib/cms';
import Select from '@/components/Select';
import { confirmDialog } from '@/components/ConfirmDialog';
import { FileLink } from '@/components/FileViewer';

interface CertificateForm {
  name: I18n;
  material: I18n;
  description: I18n;
  number: string;
  issuer: string;
  accreditation: string;
  standard: string;
  status: CertificateStatus;
  file: MediaSummary | null;
  logo: MediaSummary | null;
  isPublished: boolean;
  sortOrder: number;
}

const emptyForm = (): CertificateForm => ({
  name: emptyI18n(),
  material: emptyI18n(),
  description: emptyI18n(),
  number: '',
  issuer: '',
  accreditation: '',
  standard: '',
  status: 'active',
  file: null,
  logo: null,
  isPublished: true,
  sortOrder: 0,
});

function formFromRow(row: CertificateData): CertificateForm {
  return {
    name: row.name,
    material: row.material ?? emptyI18n(),
    description: row.description ?? emptyI18n(),
    number: row.number ?? '',
    issuer: row.issuer ?? '',
    accreditation: row.accreditation ?? '',
    standard: row.standard ?? '',
    status: row.status ?? 'active',
    file: row.file,
    logo: row.logo ?? null,
    isPublished: row.isPublished,
    sortOrder: row.sortOrder,
  };
}

// CertificateRequest replaces every field on update, so always send the full record.
function toPayload(form: CertificateForm) {
  return {
    name: form.name,
    material: form.material,
    description: form.description,
    number: form.number || null,
    issuer: form.issuer || null,
    accreditation: form.accreditation || null,
    standard: form.standard || null,
    status: form.status,
    mediaId: form.file?.id ?? null,
    logoMediaId: form.logo?.id ?? null,
    isPublished: form.isPublished,
    sortOrder: form.sortOrder,
  };
}

export default function AdminCertificates() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<CertificateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CertificateForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<CertificateData[]>('/admin/certificates'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openForm(row: CertificateData | null) {
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
        await api(`/admin/certificates/${editingId}`, { method: 'PUT', body: toPayload(form) });
      } else {
        await api('/admin/certificates', { method: 'POST', body: toPayload(form) });
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

  async function togglePublished(row: CertificateData) {
    setError('');
    try {
      await api(`/admin/certificates/${row.id}`, {
        method: 'PUT',
        body: toPayload({ ...formFromRow(row), isPublished: !row.isPublished }),
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: CertificateData) {
    if (!await confirmDialog(t(`Hapus sertifikat "${tr(row.name, lang)}"?`, `Delete certificate "${tr(row.name, lang)}"?`))) return;
    setError('');
    try {
      await api(`/admin/certificates/${row.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<CertificateData>[] = [
    {
      key: 'name',
      label: t('Sertifikat', 'Certificate'),
      render: (c) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {c.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logo.url} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, background: '#fff', border: '1px solid var(--line)', padding: 4 }} />
          ) : null}
          <strong>{tr(c.name, lang)}</strong>
        </span>
      ),
    },
    { key: 'material', label: t('Kategori', 'Category'), render: (c) => tr(c.material, lang) || '—' },
    {
      key: 'file',
      label: t('Berkas', 'File'),
      render: (c) =>
        c.file ? (
          <FileLink file={{ url: c.file.url, name: c.file.originalName, mime: c.file.mime }} className="cms-link mono">
            {c.file.originalName}
          </FileLink>
        ) : (
          '—'
        ),
    },
    { key: 'sortOrder', label: t('Urutan', 'Order'), align: 'right' },
    {
      key: 'isPublished',
      label: 'Status',
      render: (c) => (
        <StatusBadge label={c.isPublished ? t('Tampil', 'Visible') : t('Draf', 'Draft')} tone={c.isPublished ? 'ok' : 'warn'} small />
      ),
    },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (c) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(c) },
            c.isPublished
              ? { label: t('Sembunyikan', 'Hide'), tone: 'danger', onClick: () => void togglePublished(c) }
              : { label: t('Tampilkan', 'Show'), tone: 'success', onClick: () => void togglePublished(c) },
            { label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void remove(c) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Sertifikat', 'Certificates')}
        desc={t('Kelola sertifikat dan kepatuhan (ISO, REACH, dll).', 'Manage certificates and compliance documents (ISO, REACH, etc).')}
        action={{ label: t('Tambah sertifikat', 'Add certificate'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable columns={columns} rows={rows} loading={loading} empty={loading ? t('Memuat sertifikat...', 'Loading certificates...') : t('Belum ada sertifikat.', 'No certificates yet.')} />

      {formOpen && (
        <AdminModal title={editingId ? t('Edit sertifikat', 'Edit certificate') : t('Tambah sertifikat', 'Add certificate')} onClose={closeForm} width={880}>
          <form className="admin-form" onSubmit={(event) => void submit(event)}>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <I18nInput
              label={t('Nama sertifikat', 'Certificate name')}
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              required
              maxLength={200}
              errorId={firstError(formErrors, 'name.id', 'name')}
              errorEn={firstError(formErrors, 'name.en')}
            />
            <I18nInput
              label={t('Kategori sertifikat', 'Certificate category')}
              value={form.material}
              onChange={(material) => setForm({ ...form, material })}
              maxLength={200}
              placeholder="Contoh: Anti-penyuapan"
              errorId={firstError(formErrors, 'material.id')}
              errorEn={firstError(formErrors, 'material.en')}
            />
            <I18nInput
              label={t('Deskripsi', 'Description')}
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
              multiline
              rows={3}
              maxLength={2000}
              errorId={firstError(formErrors, 'description.id')}
              errorEn={firstError(formErrors, 'description.en')}
            />
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Nomor sertifikat', 'Certificate number')}</span>
                <input value={form.number} maxLength={120} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </label>
              <label>
                <span className="field-label">{t('Penerbit', 'Issuer')}</span>
                <input value={form.issuer} maxLength={160} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
              </label>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Akreditasi', 'Accreditation')}</span>
                <input value={form.accreditation} maxLength={120} onChange={(e) => setForm({ ...form, accreditation: e.target.value })} />
              </label>
              <label>
                <span className="field-label">{t('Standar', 'Standard')}</span>
                <input value={form.standard} maxLength={120} onChange={(e) => setForm({ ...form, standard: e.target.value })} />
              </label>
              <label>
                <span className="field-label">{t('Status sertifikat', 'Certificate status')}</span>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CertificateStatus })}>
                  <option value="active">{t('Aktif', 'Active')}</option>
                  <option value="expired">{t('Kedaluwarsa', 'Expired')}</option>
                  <option value="in_progress">{t('Dalam proses', 'In progress')}</option>
                </Select>
              </label>
            </div>
            <MediaPicker
              label={t('Berkas sertifikat (PDF)', 'Certificate file (PDF)')}
              value={form.file}
              onChange={(file) => setForm({ ...form, file })}
              accept="document"
              collection="certificates"
              error={firstError(formErrors, 'mediaId')}
            />
            <MediaPicker
              label={t('Logo sertifikat', 'Certificate logo')}
              value={form.logo}
              onChange={(logo) => setForm({ ...form, logo })}
              accept="image"
              collection="certificates"
              hint={t('PNG/SVG berlatar transparan atau putih, mis. lencana ISO atau logo lembaga sertifikasi.', 'PNG/SVG with a transparent or white background, e.g. the ISO badge or the certifying body logo.')}
              error={firstError(formErrors, 'logoMediaId')}
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
                {saving ? t('Menyimpan...', 'Saving...') : editingId ? t('Simpan perubahan', 'Save changes') : t('Tambah sertifikat', 'Add certificate')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
