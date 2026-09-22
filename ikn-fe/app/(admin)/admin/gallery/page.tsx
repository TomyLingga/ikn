'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';

type GalleryType = 'image' | 'video';

interface GalleryRow {
  id: string;
  title: string;
  type: GalleryType;
  src: string;
  published: boolean;
}

interface GalleryForm {
  title: string;
  type: GalleryType;
  src: string;
}

const emptyForm: GalleryForm = { title: '', type: 'image', src: '' };

export default function AdminGallery() {
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GalleryForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<GalleryRow[]>('/admin/gallery'));
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
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(row: GalleryRow) {
    setEditingId(row.id);
    setForm({ title: row.title, type: row.type, src: row.src });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    const editing = rows.find((row) => row.id === editingId);
    const body = {
      title: form.title.trim(),
      type: form.type,
      src: form.src.trim(),
      published: editing ? editing.published : true,
    };
    try {
      if (editingId) {
        await api(`/admin/gallery/${encodeURIComponent(editingId)}`, { method: 'PUT', body });
      } else {
        await api('/admin/gallery', { method: 'POST', body });
      }
      await refresh();
      closeForm();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(row: GalleryRow) {
    setError('');
    try {
      await api(`/admin/gallery/${encodeURIComponent(row.id)}`, {
        method: 'PUT',
        body: { title: row.title, type: row.type, src: row.src, published: !row.published },
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: GalleryRow) {
    if (!window.confirm(`Hapus item galeri "${row.title}"?`)) return;
    setError('');
    try {
      await api(`/admin/gallery/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<GalleryRow>[] = [
    { key: 'title', label: 'Judul' },
    { key: 'type', label: 'Tipe', render: (g) => (g.type === 'video' ? 'Video' : 'Gambar') },
    {
      key: 'src',
      label: 'Sumber',
      render: (g) => <span className="mono">{g.type === 'video' ? `youtu.be/${g.src}` : g.src}</span>,
    },
    {
      key: 'published',
      label: 'Status',
      render: (g) => <StatusBadge label={g.published ? 'Tampil' : 'Draf'} tone={g.published ? 'ok' : 'warn'} small />,
    },
    {
      key: 'act',
      label: 'Aksi',
      render: (g) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openEdit(g) },
            g.published
              ? { label: 'Sembunyikan', tone: 'danger', onClick: () => void togglePublished(g) }
              : { label: 'Tampilkan', tone: 'success', onClick: () => void togglePublished(g) },
            { label: 'Hapus', tone: 'danger', onClick: () => void remove(g) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title="Gallery"
        desc="Kelola galeri foto dan video kegiatan serta fasilitas."
        action={{ label: 'Tambah item', icon: 'plus', onClick: openAdd }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        empty={loading ? 'Memuat galeri...' : 'Belum ada item galeri.'}
      />

      {formOpen && (
        <div className="admin-modal-backdrop" onClick={closeForm}>
          <div className="admin-modal admin-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{editingId ? 'Edit item galeri' : 'Tambah item galeri'}</h2>
              <button type="button" className="admin-modal-close" onClick={closeForm}>✕</button>
            </div>
            <form className="admin-form" onSubmit={(event) => void submit(event)}>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <label>
                <span className="field-label">Judul</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </label>
              <label>
                <span className="field-label">Tipe</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as GalleryType })}>
                  <option value="image">Gambar</option>
                  <option value="video">Video (YouTube)</option>
                </select>
              </label>
              <label>
                <span className="field-label">{form.type === 'video' ? 'ID video YouTube' : 'Path gambar'}</span>
                <input
                  value={form.src}
                  onChange={(e) => setForm({ ...form, src: e.target.value })}
                  placeholder={form.type === 'video' ? 'Contoh: dQw4w9WgXcQ' : '/img/galeri-1.webp'}
                  required
                />
              </label>
              <p className="admin-note">
                Untuk gambar, unggah berkas lewat halaman Video &amp; Gambar lalu salin path-nya, atau isi path manual.
              </p>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>Batal</button>
                <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
