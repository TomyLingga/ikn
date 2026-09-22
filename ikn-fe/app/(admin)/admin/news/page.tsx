'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface NewsRow {
  slug: string;
  title: string;
  titleEn: string;
  tag: string;
  date: string;
  thumb: string;
  excerpt: string | null;
  excerptEn: string | null;
  body: string | null;
  bodyEn: string | null;
  published: boolean;
}

interface NewsForm {
  title: string;
  tag: string;
  date: string;
  thumb: string;
  excerpt: string;
  body: string;
  published: boolean;
}

const emptyForm: NewsForm = {
  title: '',
  tag: '',
  date: '',
  thumb: '',
  excerpt: '',
  body: '',
  published: true,
};

export default function AdminNews() {
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState<NewsForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<NewsRow[]>('/admin/news'));
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
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(row: NewsRow) {
    setEditingSlug(row.slug);
    setForm({
      title: row.title,
      tag: row.tag || '',
      date: (row.date || '').slice(0, 10),
      thumb: row.thumb || '',
      excerpt: row.excerpt || '',
      body: row.body || '',
      published: row.published,
    });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingSlug(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function uploadThumb(file: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('File yang dipilih harus berupa gambar (JPG, PNG, WebP).');
      return;
    }
    setUploading(true);
    setFormError('');
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setForm((current) => ({ ...current, thumb: dataUrl }));
        }
        setUploading(false);
      };
      reader.onerror = () => {
        setFormError('Gagal membaca file gambar.');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setFormError(errorMessage(err));
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    const body = {
      title: form.title.trim(),
      tag: form.tag.trim(),
      date: form.date || undefined,
      thumb: form.thumb.trim(),
      excerpt: form.excerpt.trim(),
      body: form.body,
      published: form.published,
    };
    try {
      if (editingSlug) {
        await api(`/admin/news/${encodeURIComponent(editingSlug)}`, { method: 'PUT', body });
      } else {
        await api('/admin/news', { method: 'POST', body });
      }
      await refresh();
      closeForm();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(row: NewsRow) {
    setError('');
    try {
      await api(`/admin/news/${encodeURIComponent(row.slug)}`, {
        method: 'PUT',
        body: {
          title: row.title,
          titleEn: row.titleEn,
          tag: row.tag,
          date: (row.date || '').slice(0, 10) || undefined,
          thumb: row.thumb,
          excerpt: row.excerpt,
          excerptEn: row.excerptEn,
          body: row.body,
          bodyEn: row.bodyEn,
          published: !row.published,
        },
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: NewsRow) {
    if (!window.confirm(`Hapus berita "${row.title}"?`)) return;
    setError('');
    try {
      await api(`/admin/news/${encodeURIComponent(row.slug)}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<NewsRow>[] = [
    { key: 'title', label: 'Judul' },
    { key: 'tag', label: 'Kategori', render: (n) => n.tag || '—' },
    { key: 'date', label: 'Tanggal', render: (n) => formatDate(n.date) },
    {
      key: 'published',
      label: 'Status',
      render: (n) => <StatusBadge label={n.published ? 'Terbit' : 'Draf'} tone={n.published ? 'ok' : 'warn'} small />,
    },
    {
      key: 'act',
      label: 'Aksi',
      render: (n) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openEdit(n) },
            n.published
              ? { label: 'Jadikan draf', tone: 'danger', onClick: () => void togglePublished(n) }
              : { label: 'Terbitkan', tone: 'success', onClick: () => void togglePublished(n) },
            { label: 'Hapus', tone: 'danger', onClick: () => void remove(n) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title="News"
        desc="Kelola berita dan artikel perusahaan."
        action={{ label: 'Tulis berita', icon: 'plus', onClick: openAdd }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey="slug"
        empty={loading ? 'Memuat berita...' : 'Belum ada berita.'}
      />

      {formOpen && (
        <div className="admin-modal-backdrop" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{editingSlug ? 'Edit berita' : 'Tulis berita'}</h2>
              <button type="button" className="admin-modal-close" onClick={closeForm}>✕</button>
            </div>
            <form className="admin-form" onSubmit={(event) => void submit(event)}>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Judul</span>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </label>
                <label>
                  <span className="field-label">Kategori/tag</span>
                  <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Contoh: Perusahaan" />
                </label>
              </div>
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Tanggal</span>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Status</span>
                  <select
                    value={form.published ? '1' : '0'}
                    onChange={(e) => setForm({ ...form, published: e.target.value === '1' })}
                  >
                    <option value="1">Terbit</option>
                    <option value="0">Draf</option>
                  </select>
                </label>
              </div>
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Thumbnail (path)</span>
                  <input value={form.thumb} onChange={(e) => setForm({ ...form, thumb: e.target.value })} placeholder="/img/berita-1.webp" />
                </label>
                <label>
                  <span className="field-label">Unggah thumbnail {uploading ? '(mengunggah...)' : ''}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadThumb(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
              <label>
                <span className="field-label">Ringkasan (excerpt)</span>
                <textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
              </label>
              <label>
                <span className="field-label">Isi berita</span>
                <textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </label>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>Batal</button>
                <button type="submit" className="btn btn-solid btn-sm" disabled={saving || uploading}>
                  {saving ? 'Menyimpan...' : editingSlug ? 'Simpan perubahan' : 'Terbitkan berita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
