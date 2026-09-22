'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';

interface CertificateRow {
  id: string;
  name: string;
  material: string;
  desc: string;
  file: string;
  image: string;
  published: boolean;
}

interface CertificateForm {
  name: string;
  material: string;
  desc: string;
  file: string;
  image: string;
}

const emptyForm: CertificateForm = { name: '', material: '', desc: '', file: '', image: '' };

export default function AdminCertificates() {
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CertificateForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'file' | 'image' | null>(null);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<CertificateRow[]>('/admin/certificates'));
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

  function openEdit(row: CertificateRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      material: row.material || '',
      desc: row.desc || '',
      file: row.file || '',
      image: row.image || '',
    });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function upload(field: 'file' | 'image', file: File) {
    if (!file) return;
    setUploading(field);
    setFormError('');
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setForm((current) => ({ ...current, [field]: dataUrl }));
        }
        setUploading(null);
      };
      reader.onerror = () => {
        setFormError('Gagal membaca file.');
        setUploading(null);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setFormError(errorMessage(err));
      setUploading(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    const editing = rows.find((row) => row.id === editingId);
    const body = {
      name: form.name.trim(),
      material: form.material.trim(),
      desc: form.desc.trim(),
      file: form.file.trim(),
      image: form.image.trim(),
      published: editing ? editing.published : true,
    };
    try {
      if (editingId) {
        await api(`/admin/certificates/${encodeURIComponent(editingId)}`, { method: 'PUT', body });
      } else {
        await api('/admin/certificates', { method: 'POST', body });
      }
      await refresh();
      closeForm();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(row: CertificateRow) {
    setError('');
    try {
      await api(`/admin/certificates/${encodeURIComponent(row.id)}`, {
        method: 'PUT',
        body: {
          name: row.name,
          material: row.material,
          desc: row.desc,
          file: row.file,
          image: row.image,
          published: !row.published,
        },
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: CertificateRow) {
    if (!window.confirm(`Hapus sertifikat "${row.name}"?`)) return;
    setError('');
    try {
      await api(`/admin/certificates/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<CertificateRow>[] = [
    { key: 'name', label: 'Sertifikat' },
    { key: 'material', label: 'Materi/standar', render: (c) => c.material || '—' },
    { key: 'file', label: 'Berkas', render: (c) => (c.file ? <span className="mono">{c.file}</span> : '—') },
    {
      key: 'published',
      label: 'Status',
      render: (c) => <StatusBadge label={c.published ? 'Tampil' : 'Draf'} tone={c.published ? 'ok' : 'warn'} small />,
    },
    {
      key: 'act',
      label: 'Aksi',
      render: (c) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openEdit(c) },
            c.published
              ? { label: 'Sembunyikan', tone: 'danger', onClick: () => void togglePublished(c) }
              : { label: 'Tampilkan', tone: 'success', onClick: () => void togglePublished(c) },
            { label: 'Hapus', tone: 'danger', onClick: () => void remove(c) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title="Certificate"
        desc="Kelola sertifikat & kepatuhan (ISO, REACH, dll)."
        action={{ label: 'Tambah sertifikat', icon: 'plus', onClick: openAdd }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        empty={loading ? 'Memuat sertifikat...' : 'Belum ada sertifikat.'}
      />

      {formOpen && (
        <div className="admin-modal-backdrop" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{editingId ? 'Edit sertifikat' : 'Tambah sertifikat'}</h2>
              <button type="button" className="admin-modal-close" onClick={closeForm}>✕</button>
            </div>
            <form className="admin-form" onSubmit={(event) => void submit(event)}>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Nama sertifikat</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </label>
                <label>
                  <span className="field-label">Materi/standar</span>
                  <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="Contoh: ISO 9001:2015" />
                </label>
              </div>
              <label>
                <span className="field-label">Deskripsi</span>
                <textarea rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
              </label>
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Berkas (path)</span>
                  <input value={form.file} onChange={(e) => setForm({ ...form, file: e.target.value })} placeholder="/files/sertifikat-iso.pdf" />
                </label>
                <label>
                  <span className="field-label">Unggah berkas {uploading === 'file' ? '(mengunggah...)' : ''}</span>
                  <input
                    type="file"
                    disabled={uploading !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload('file', file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Gambar (path)</span>
                  <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="/img/sertifikat-iso.webp" />
                </label>
                <label>
                  <span className="field-label">Unggah gambar {uploading === 'image' ? '(mengunggah...)' : ''}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload('image', file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>Batal</button>
                <button type="submit" className="btn btn-solid btn-sm" disabled={saving || uploading !== null}>
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah sertifikat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
