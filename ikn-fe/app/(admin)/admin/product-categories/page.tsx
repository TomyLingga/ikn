'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';

interface AdminCategory {
  slug: string;
  name: string;
  nameEn: string;
  desc: string;
  productCount: number;
}

interface CategoryForm {
  name: string;
  nameEn: string;
  desc: string;
  slug: string;
}

const emptyForm: CategoryForm = { name: '', nameEn: '', desc: '', slug: '' };

export default function AdminProductCategories() {
  const [rows, setRows] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<AdminCategory[]>('/admin/categories'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openAdd() {
    setEditingSlug(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(category: AdminCategory) {
    setEditingSlug(category.slug);
    setForm({ name: category.name, nameEn: category.nameEn, desc: category.desc, slug: category.slug });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingSlug(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    try {
      if (editingSlug) {
        await api(`/admin/categories/${encodeURIComponent(editingSlug)}`, {
          method: 'PUT',
          body: { name: form.name.trim(), nameEn: form.nameEn.trim(), desc: form.desc.trim() },
        });
      } else {
        await api('/admin/categories', {
          method: 'POST',
          body: {
            name: form.name.trim(),
            nameEn: form.nameEn.trim() || undefined,
            desc: form.desc.trim() || undefined,
            slug: form.slug.trim() || undefined,
          },
        });
      }
      await refresh();
      closeForm();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(category: AdminCategory) {
    if (!window.confirm(`Hapus kategori "${category.name}"?`)) return;
    setError('');
    try {
      await api(`/admin/categories/${encodeURIComponent(category.slug)}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<AdminCategory>[] = [
    { key: 'name', label: 'Nama kategori' },
    { key: 'slug', label: 'Slug', render: (c) => <span className="mono">{c.slug}</span> },
    { key: 'desc', label: 'Deskripsi' },
    { key: 'productCount', label: 'Produk', align: 'right', render: (c) => String(c.productCount) },
    {
      key: 'act',
      label: 'Aksi',
      render: (c) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openEdit(c) },
            { label: 'Hapus', tone: 'danger', onClick: () => void remove(c) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title="Kategori Produk"
        desc="Kelompokkan produk ke dalam kategori."
        action={{ label: 'Tambah kategori', icon: 'plus', onClick: openAdd }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey="slug"
        empty={loading ? 'Memuat kategori...' : 'Belum ada kategori.'}
      />

      {formOpen && (
        <div className="admin-modal-backdrop" onClick={closeForm}>
          <div className="admin-modal admin-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{editingSlug ? `Edit kategori: ${editingSlug}` : 'Tambah kategori'}</h2>
              <button type="button" className="admin-modal-close" onClick={closeForm}>✕</button>
            </div>
            <form className="admin-form" onSubmit={(event) => void submit(event)}>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Nama kategori</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </label>
                <label>
                  <span className="field-label">Nama (EN)</span>
                  <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
                </label>
              </div>
              {!editingSlug && (
                <label>
                  <span className="field-label">Slug (opsional, otomatis dari nama)</span>
                  <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="misal: barang-teknik" />
                </label>
              )}
              <label>
                <span className="field-label">Deskripsi</span>
                <textarea rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
              </label>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>Batal</button>
                <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                  {saving ? 'Menyimpan...' : editingSlug ? 'Simpan perubahan' : 'Tambah kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
