'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, AdminCard, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';

type GalleryType = 'image' | 'video';

interface GalleryRow {
  id: string;
  title: string;
  type: GalleryType;
  src: string;
  published: boolean;
}

export default function AdminMedia() {
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [fileKey, setFileKey] = useState(0);

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

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!file) {
      setFormError('Pilih berkas gambar terlebih dahulu.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploaded = await api<{ url: string; name: string }>('/admin/media', { method: 'POST', formData });
      await api('/admin/gallery', {
        method: 'POST',
        body: {
          title: title.trim() || uploaded.name,
          type: 'image',
          src: uploaded.url,
          published: true,
        },
      });
      setTitle('');
      setFile(null);
      setFileKey((key) => key + 1);
      setNotice('Gambar berhasil diunggah dan disimpan ke galeri.');
      await refresh();
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
    if (!window.confirm(`Hapus media "${row.title}"?`)) return;
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
      <AdminPageHead title="Video & Gambar" desc="Unggah gambar dan kelola aset media yang tampil di beranda dan galeri." />

      {notice && <div className="admin-toast" role="status">{notice}</div>}
      {error && <p className="form-error">{error}</p>}

      <div style={{ marginBottom: 22 }}>
        <AdminCard title="Unggah gambar baru">
          <form className="admin-form" onSubmit={(event) => void submit(event)}>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="admin-form-row">
              <label>
                <span className="field-label">Judul media</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Fasilitas produksi" />
              </label>
              <label>
                <span className="field-label">Berkas gambar</span>
                <input
                  key={fileKey}
                  type="file"
                  accept="image/*"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  required
                />
              </label>
            </div>
            <p className="admin-note">Berkas diunggah ke server lalu otomatis tercatat sebagai item galeri bertipe gambar. Untuk video YouTube, tambahkan lewat halaman Gallery.</p>
            <div className="row-actions">
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? 'Mengunggah...' : 'Unggah & simpan'}
              </button>
            </div>
          </form>
        </AdminCard>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        empty={loading ? 'Memuat media...' : 'Belum ada media.'}
      />
    </div>
  );
}
