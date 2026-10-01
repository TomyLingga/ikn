'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminCard, AdminPageHead, DataTable, type Column } from '@/components/admin/AdminPage';
import { I18nInput, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n, type PostCategory } from '@/lib/cms';
import { confirmDialog } from '@/components/ConfirmDialog';

interface CategoryForm {
  name: I18n;
  slug: string;
  sortOrder: number;
}

const emptyCategory = (): CategoryForm => ({ name: emptyI18n(), slug: '', sortOrder: 0 });

// Kategori berita: GET/POST /admin/news-categories, PUT/DELETE /admin/news-categories/{id} (modul news).
// Dipakai sebagai pilihan di editor berita dan filter di halaman Berita publik.
export default function AdminNewsCategories() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<PostCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<CategoryForm>(emptyCategory());
  const [editing, setEditing] = useState<PostCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await api<PostCategory[]>('/admin/news-categories'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function startEdit(category: PostCategory) {
    setEditing(category);
    setForm({ name: category.name, slug: category.slug, sortOrder: category.sortOrder ?? 0 });
    setErrors({});
  }

  function cancelEdit() {
    setEditing(null);
    setForm(emptyCategory());
    setErrors({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setErrors({});
    const body = { name: form.name, slug: form.slug.trim() || null, sortOrder: form.sortOrder };
    try {
      if (editing) {
        await api(`/admin/news-categories/${editing.id}`, { method: 'PUT', body });
        setNotice(t('Kategori diperbarui.', 'Category updated.'));
      } else {
        await api('/admin/news-categories', { method: 'POST', body });
        setNotice(t('Kategori ditambahkan.', 'Category added.'));
      }
      cancelEdit();
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(err.errors);
        setError(err.message);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(category: PostCategory) {
    const name = tr(category.name, lang);
    if (!await confirmDialog(t(`Hapus kategori "${name}"? Berita di dalamnya tetap ada tanpa kategori.`, `Delete category "${name}"? Its posts are kept without a category.`))) return;
    setError('');
    try {
      await api(`/admin/news-categories/${category.id}`, { method: 'DELETE' });
      setNotice(t('Kategori dihapus.', 'Category deleted.'));
      if (editing?.id === category.id) cancelEdit();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<PostCategory>[] = [
    {
      key: 'name',
      label: t('Nama', 'Name'),
      render: (c) => (
        <div>
          <strong>{tr(c.name, lang)}</strong>
          <small style={{ display: 'block', color: 'var(--ink-soft)', fontSize: '0.76rem' }} className="mono">
            /berita?category={c.slug}
          </small>
        </div>
      ),
    },
    { key: 'postCount', label: t('Berita', 'Posts'), render: (c) => String(c.postCount ?? 0) },
    { key: 'sortOrder', label: t('Urutan', 'Order'), render: (c) => String(c.sortOrder ?? 0) },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (c) => (
        <div className="row-actions">
          <button type="button" className="row-act" onClick={() => startEdit(c)}>
            Edit
          </button>
          <button type="button" className="row-act row-act-danger" onClick={() => void remove(c)}>
            {t('Hapus', 'Delete')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Kategori Berita', 'News Categories')}
        desc={t('Kategori dipilih di editor berita dan menjadi filter di halaman Berita publik.', 'Categories are chosen in the news editor and become filters on the public News page.')}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22, alignItems: 'start' }}>
        <AdminCard title={t('Daftar kategori', 'Categories')}>
          {loading ? (
            <div className="admin-empty">{t('Memuat...', 'Loading...')}</div>
          ) : (
            <DataTable columns={columns} rows={rows} rowKey="id" empty={t('Belum ada kategori. Tambahkan lewat formulir di samping.', 'No categories yet. Add one with the form.')} />
          )}
        </AdminCard>

        <AdminCard title={editing ? t('Ubah kategori', 'Edit category') : t('Kategori baru', 'New category')}>
          <form onSubmit={(event) => void submit(event)} className="admin-form">
            <I18nInput
              label={t('Nama', 'Name')}
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              maxLength={80}
              required
              errorId={firstError(errors, 'name.id', 'name')}
              errorEn={firstError(errors, 'name.en')}
            />
            <label>
              <span className="field-label">Slug</span>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={t('kosong = otomatis dari nama', 'blank = generated from name')} maxLength={80} className="mono" />
              {firstError(errors, 'slug') && <small className="cms-field-error">{firstError(errors, 'slug')}</small>}
            </label>
            <label>
              <span className="field-label">{t('Urutan', 'Order')}</span>
              <input type="number" min={0} max={1000} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              <small className="admin-field-hint">{t('Angka kecil tampil lebih dulu di filter.', 'Lower numbers appear first in the filter.')}</small>
            </label>
            <div className="row-actions">
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : editing ? t('Simpan perubahan', 'Save changes') : t('Tambah kategori', 'Add category')}
              </button>
              {editing && (
                <button type="button" className="btn btn-line btn-sm" onClick={cancelEdit} disabled={saving}>
                  {t('Batal', 'Cancel')}
                </button>
              )}
            </div>
          </form>
        </AdminCard>
      </div>
    </div>
  );
}
