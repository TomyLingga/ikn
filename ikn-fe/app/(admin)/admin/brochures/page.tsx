'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';

interface BrochureRow {
  id: string;
  title: string;
  file: string;
  size: string;
  published: boolean;
}

interface BrochureForm {
  title: string;
  file: string;
  size: string;
}

const emptyForm: BrochureForm = { title: '', file: '', size: '' };

export default function AdminBrochures() {
  const [rows, setRows] = useState<BrochureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrochureForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<BrochureRow[]>('/admin/brochures'));
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

  function openEdit(row: BrochureRow) {
    setEditingId(row.id);
    setForm({ title: row.title, file: row.file, size: row.size || '' });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setFormError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api<{ url: string; name: string }>('/admin/media', { method: 'POST', formData });
      const sizeMb = file.size >= 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;
      setForm((current) => ({ ...current, file: result.url, size: current.size || sizeMb }));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    const editing = rows.find((row) => row.id === editingId);
    const body = {
      title: form.title.trim(),
      file: form.file.trim(),
      size: form.size.trim(),
      published: editing ? editing.published : true,
    };
    try {
      if (editingId) {
        await api(`/admin/brochures/${encodeURIComponent(editingId)}`, { method: 'PUT', body });
      } else {
        await api('/admin/brochures', { method: 'POST', body });
      }
      await refresh();
      closeForm();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(row: BrochureRow) {
    setError('');
    try {
      await api(`/admin/brochures/${encodeURIComponent(row.id)}`, {
        method: 'PUT',
        body: { title: row.title, file: row.file, size: row.size, published: !row.published },
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: BrochureRow) {
    if (!window.confirm(`Hapus brosur "${row.title}"?`)) return;
    setError('');
    try {
      await api(`/admin/brochures/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<BrochureRow>[] = [
    { key: 'title', label: 'Judul' },
    { key: 'file', label: 'Berkas', render: (b) => <span className="mono">{b.file}</span> },
    { key: 'size', label: 'Ukuran', align: 'right', render: (b) => b.size || '—' },
    {
      key: 'published',
      label: 'Status',
      render: (b) => <StatusBadge label={b.published ? 'Tampil' : 'Draf'} tone={b.published ? 'ok' : 'warn'} small />,
    },
    {
      key: 'act',
      label: 'Aksi',
      render: (b) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openEdit(b) },
            b.published
              ? { label: 'Sembunyikan', tone: 'danger', onClick: () => void togglePublished(b) }
              : { label: 'Tampilkan', tone: 'success', onClick: () => void togglePublished(b) },
            { label: 'Hapus', tone: 'danger', onClick: () => void remove(b) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title="Brochure"
        desc="Kelola brosur produk yang dapat diunduh pengunjung."
        action={{ label: 'Unggah brosur', icon: 'plus', onClick: openAdd }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        empty={loading ? 'Memuat brosur...' : 'Belum ada brosur.'}
      />

      {formOpen && (
        <div className="admin-modal-backdrop" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{editingId ? 'Edit brosur' : 'Tambah brosur'}</h2>
              <button type="button" className="admin-modal-close" onClick={closeForm}>✕</button>
            </div>
            <form className="admin-form" onSubmit={(event) => void submit(event)}>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Judul brosur</span>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </label>
                <label>
                  <span className="field-label">Ukuran (teks)</span>
                  <input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="Contoh: 2.4 MB" />
                </label>
              </div>
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Berkas (path)</span>
                  <input value={form.file} onChange={(e) => setForm({ ...form, file: e.target.value })} placeholder="/files/brosur-produk.pdf" required />
                </label>
                <label>
                  <span className="field-label">Unggah berkas {uploading ? '(mengunggah...)' : ''}</span>
                  <input
                    type="file"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadFile(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>Batal</button>
                <button type="submit" className="btn btn-solid btn-sm" disabled={saving || uploading}>
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah brosur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
