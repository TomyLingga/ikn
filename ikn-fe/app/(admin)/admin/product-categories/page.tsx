'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, MediaPicker, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n, type MediaSummary } from '@/lib/cms';
import type { Category } from '@/lib/types';
import { confirmDialog } from '@/components/ConfirmDialog';

interface CategoryForm {
  name: I18n;
  description: I18n;
  slug: string;
  image: MediaSummary | null;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm = (sortOrder: number): CategoryForm => ({ name: emptyI18n(), description: emptyI18n(), slug: '', image: null, sortOrder, isActive: true });

function formFromRow(row: Category): CategoryForm {
  return {
    name: { ...row.name },
    description: row.description ? { ...row.description } : emptyI18n(),
    slug: row.slug,
    image: row.image,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function toPayload(form: CategoryForm) {
  return {
    name: { id: form.name.id.trim(), en: form.name.en.trim() },
    description: { id: form.description.id.trim(), en: form.description.en.trim() },
    slug: form.slug.trim() || null,
    imageMediaId: form.image?.id ?? null,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
  };
}

// Kategori produk: GET/POST /admin/categories, PUT/DELETE /admin/categories/{id} (409 CATEGORY_IN_USE bila masih dipakai).
export default function AdminProductCategories() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(() => emptyForm(0));
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<Category[]>('/admin/categories'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openForm(row: Category | null) {
    setEditing(row);
    setForm(row ? formFromRow(row) : emptyForm(rows.length));
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    try {
      if (editing) {
        await api(`/admin/categories/${editing.id}`, { method: 'PUT', body: toPayload(form) });
      } else {
        await api('/admin/categories', { method: 'POST', body: toPayload(form) });
      }
      await refresh();
      setNotice(editing ? t('Kategori diperbarui.', 'Category updated.') : t('Kategori ditambahkan.', 'Category added.'));
      setFormOpen(false);
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

  async function toggleActive(row: Category) {
    setError('');
    try {
      await api(`/admin/categories/${row.id}`, { method: 'PUT', body: toPayload({ ...formFromRow(row), isActive: !row.isActive }) });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: Category) {
    if (!await confirmDialog(t(`Hapus kategori "${tr(row.name, lang)}"?`, `Delete category "${tr(row.name, lang)}"?`))) return;
    setError('');
    try {
      await api(`/admin/categories/${row.id}`, { method: 'DELETE' });
      await refresh();
      setNotice(t('Kategori dihapus.', 'Category deleted.'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CATEGORY_IN_USE') {
        setError(t(`Kategori "${tr(row.name, lang)}" masih dipakai ${row.productCount} produk (termasuk yang diarsipkan). Pindahkan produknya dulu atau nonaktifkan kategori.`, `Category "${tr(row.name, lang)}" is still used by ${row.productCount} products (including archived). Move the products first or deactivate the category.`));
      } else {
        setError(errorMessage(err));
      }
    }
  }

  const columns: Column<Category>[] = [
    {
      key: 'name',
      label: t('Kategori', 'Category'),
      render: (c) => (
        <span className="cms-cell-media">
          {c.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image.url} alt="" className="cms-cell-thumb" />
          ) : (
            <span className="cms-cell-thumb">—</span>
          )}
          <span>
            <strong>{tr(c.name, lang)}</strong>
            <small className="admin-cell-sub mono">{c.slug}</small>
          </span>
        </span>
      ),
    },
    { key: 'description', label: t('Deskripsi', 'Description'), render: (c) => <span className="admin-cell-wrap">{tr(c.description, lang) || '—'}</span> },
    { key: 'productCount', label: t('Produk', 'Products'), align: 'right', render: (c) => String(c.productCount ?? 0) },
    { key: 'sortOrder', label: t('Urutan', 'Order'), align: 'right', render: (c) => String(c.sortOrder) },
    {
      key: 'isActive',
      label: 'Status',
      render: (c) => <StatusBadge label={c.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={c.isActive ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
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
        title={t('Kategori Produk', 'Product Categories')}
        desc={t('Pengelompokan produk di katalog dan cakupan voucher.', 'Product groups used by the catalog and voucher scopes.')}
        action={{ label: t('Tambah kategori', 'Add category'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <DataTable columns={columns} rows={rows} empty={loading ? t('Memuat kategori...', 'Loading categories...') : t('Belum ada kategori.', 'No categories yet.')} />

      {formOpen && (
        <AdminModal title={editing ? `${t('Edit kategori', 'Edit category')}: ${tr(editing.name, lang)}` : t('Tambah kategori', 'Add category')} onClose={() => setFormOpen(false)}>
          <form className="admin-form" onSubmit={(e) => void submit(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <I18nInput label={t('Nama kategori', 'Category name')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required errorId={firstError(formErrors, 'name.id', 'name')} errorEn={firstError(formErrors, 'name.en')} />
            <I18nInput label={t('Deskripsi', 'Description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} multiline rows={3} errorId={firstError(formErrors, 'description.id', 'description')} errorEn={firstError(formErrors, 'description.en')} />
            <div className="admin-form-row">
              <label>
                <span className="field-label">Slug URL</span>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={t('otomatis dari nama', 'auto from name')} />
                {firstError(formErrors, 'slug') && <small className="cms-field-error">{firstError(formErrors, 'slug')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Urutan tampil', 'Display order')}</span>
                <input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <MediaPicker label={t('Gambar kategori', 'Category image')} value={form.image} onChange={(media) => setForm({ ...form, image: media })} accept="image" collection="categories" error={firstError(formErrors, 'imageMediaId')} />
            <label className="cms-check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>{t('Aktif (tampil di katalog)', 'Active (shown in catalog)')}</span>
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setFormOpen(false)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : editing ? t('Simpan perubahan', 'Save changes') : t('Tambah kategori', 'Add category')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
