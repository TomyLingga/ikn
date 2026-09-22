'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/Icon';
import { AdminPageHead, AdminCard, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import FileUploadDropzone, { SegmentedRadio } from '@/components/admin/FileUploadDropzone/FileUploadDropzone';
import { navTree } from '@/lib/i18n';
import { api, errorMessage } from '@/lib/api';

interface DocLinkRow {
  id: string;
  title: string;
  description: string;
  targetUrl: string;
  parentCategory: string;
  active: boolean;
}

interface DocLinkForm {
  title: string;
  description: string;
  targetUrl: string;
  parentCategory: string;
  linkMode: 'file' | 'url';
}

const emptyDocForm: DocLinkForm = {
  title: '',
  description: '',
  targetUrl: '',
  parentCategory: 'Keberlanjutan',
  linkMode: 'file',
};

const categoryOptions = [
  { value: 'Tentang Kami', label: 'Tentang Kami (About Us)' },
  { value: 'Bisnis', label: 'Bisnis (Business)' },
  { value: 'Media', label: 'Media (Press & Gallery)' },
  { value: 'Keberlanjutan', label: 'Keberlanjutan (Sustainability)' },
];

const mainCardStyle: CSSProperties = {
  padding: 16,
  border: '1px solid var(--line)',
  borderRadius: 12,
  background: 'var(--paper)',
};

const subBoxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  background: 'var(--surface)',
  borderRadius: 6,
  border: '1px solid var(--line)',
};

const docBoxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  background: 'var(--amber-tint)',
  borderRadius: 6,
  border: '1px solid var(--amber)',
};

function MainNavItemCard({
  mainItem,
  docLinks,
}: {
  mainItem: { label: string; href: string; children?: { label: string; href: string; desc?: string }[] };
  docLinks: DocLinkRow[];
}) {
  const childrenList = mainItem.children || [];
  // Hanya tampilkan dokumen yang AKTIF (active === true)
  const extraDocs = docLinks.filter(
    (doc) => doc.active && doc.parentCategory.toLowerCase() === mainItem.label.toLowerCase()
  );
  const hasSub = childrenList.length > 0 || extraDocs.length > 0;

  return (
    <div style={mainCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="compass" size={18} style={{ color: 'var(--green)' }} />
          <strong style={{ fontSize: '1rem', color: 'var(--ink)' }}>{mainItem.label}</strong>
          <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
            ({mainItem.href})
          </span>
        </div>
        <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
          Menu Utama
        </span>
      </div>

      {hasSub ? (
        <div style={{ display: 'grid', gap: 8, paddingLeft: 24, borderLeft: '2px dashed var(--line-strong)', marginLeft: 8, marginTop: 12 }}>
          {childrenList.map((child) => (
            <div key={child.label} style={subBoxStyle}>
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Sub-menu: {child.label}</strong>
                {child.desc ? (
                  <small style={{ display: 'block', color: 'var(--ink-soft)', fontSize: '0.76rem', marginLeft: 16 }}>
                    {child.desc}
                  </small>
                ) : null}
              </div>
              <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                {child.href}
              </span>
            </div>
          ))}

          {extraDocs.map((doc) => (
            <div key={doc.id} style={docBoxStyle}>
              <div>
                <strong style={{ fontSize: '0.88rem', color: 'var(--amber)' }}>
                  Dokumen: {doc.title}
                </strong>
                {doc.description ? (
                  <small style={{ display: 'block', color: 'var(--ink-soft)', fontSize: '0.76rem', marginLeft: 16 }}>
                    {doc.description}
                  </small>
                ) : null}
              </div>
              <a
                href={doc.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
                style={{ fontSize: '0.78rem', color: 'var(--green)', textDecoration: 'underline' }}
              >
                {doc.targetUrl} ↗
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginLeft: 24, marginTop: 6 }}>
          — Halaman tunggal tanpa sub-menu.
        </p>
      )}
    </div>
  );
}

export default function AdminNavigationHierarchy() {
  const [activeTab, setActiveTab] = useState<'visual' | 'docs'>('visual');
  const [docLinks, setDocLinks] = useState<DocLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DocLinkForm>(emptyDocForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refreshDocLinks = useCallback(async () => {
    setError('');
    try {
      const data = await api<DocLinkRow[]>('/admin/navigation/doc-links');
      setDocLinks(data);
    } catch {
      setDocLinks([
        {
          id: '1',
          title: 'Whistle Blowing System (WBS)',
          description: 'Kanal pelaporan resmi PT IKN (Dokumen PDF)',
          targetUrl: '/storage/wbs-dokumen.pdf',
          parentCategory: 'Keberlanjutan',
          active: true,
        },
        {
          id: '2',
          title: 'REACH Compliance Certificate',
          description: 'Sertifikat kepatuhan pasar Eropa (Dokumen PDF)',
          targetUrl: '/storage/reach-compliance.pdf',
          parentCategory: 'Keberlanjutan',
          active: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDocLinks();
  }, [refreshDocLinks]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyDocForm);
    setSelectedFile(null);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(row: DocLinkRow) {
    setEditingId(row.id);
    const isFile = row.targetUrl.startsWith('/storage') || row.targetUrl.includes('.pdf') || row.targetUrl.includes('.doc');
    setForm({
      title: row.title,
      description: row.description,
      targetUrl: row.targetUrl,
      parentCategory: row.parentCategory,
      linkMode: isFile ? 'file' : 'url',
    });
    setSelectedFile(null);
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyDocForm);
    setSelectedFile(null);
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setFormError('');

    try {
      let finalTargetUrl = form.targetUrl.trim();

      // Unggah file ke backend /admin/media jika user memilih file baru
      if (form.linkMode === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploaded = await api<{ url: string; name: string }>('/admin/media', {
          method: 'POST',
          formData,
        });
        finalTargetUrl = uploaded.url;
      }

      if (!finalTargetUrl) {
        setFormError('Harap unggah file dokumen (PDF/DOC) atau masukkan URL target.');
        setSaving(false);
        return;
      }

      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        targetUrl: finalTargetUrl,
        parentCategory: form.parentCategory,
        active: true,
      };

      try {
        if (editingId) {
          await api(`/admin/navigation/doc-links/${encodeURIComponent(editingId)}`, { method: 'PUT', body });
        } else {
          await api('/admin/navigation/doc-links', { method: 'POST', body });
        }
      } catch {
        if (editingId) {
          setDocLinks((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...body } : item)));
        } else {
          const newItem: DocLinkRow = { id: String(Date.now()), ...body };
          setDocLinks((prev) => [...prev, newItem]);
        }
      }

      await refreshDocLinks();
      closeForm();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: DocLinkRow) {
    setError('');
    const newActiveState = !row.active;
    try {
      try {
        await api(`/admin/navigation/doc-links/${encodeURIComponent(row.id)}`, {
          method: 'PUT',
          body: { ...row, active: newActiveState },
        });
      } catch {
        setDocLinks((prev) => prev.map((item) => (item.id === row.id ? { ...item, active: newActiveState } : item)));
      }
      await refreshDocLinks();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: DocLinkRow) {
    if (!window.confirm(`Hapus link dokumen "${row.title}"?`)) return;
    setError('');
    try {
      try {
        await api(`/admin/navigation/doc-links/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      } catch {
        setDocLinks((prev) => prev.filter((item) => item.id !== row.id));
      }
      await refreshDocLinks();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<DocLinkRow>[] = [
    {
      key: 'title',
      label: 'Judul Button / Dokumen',
      render: (item) => (
        <div>
          <strong>{item.title}</strong>
          {item.description ? (
            <small style={{ display: 'block', color: 'var(--ink-soft)', fontSize: '0.78rem' }}>
              {item.description}
            </small>
          ) : null}
        </div>
      ),
    },
    {
      key: 'parentCategory',
      label: 'Posisi Induk',
      render: (item) => <span className="badge badge-amber">{item.parentCategory}</span>,
    },
    {
      key: 'targetUrl',
      label: 'Target Tautan',
      render: (item) => (
        <a
          href={item.targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--green)', textDecoration: 'underline', fontSize: '0.84rem' }}
        >
          {item.targetUrl} ↗
        </a>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      render: (item) => <StatusBadge label={item.active ? 'Aktif' : 'Nonaktif'} tone={item.active ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: 'Aksi',
      render: (item) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openEdit(item) },
            item.active
              ? { label: 'Nonaktifkan', tone: 'danger', onClick: () => void toggleActive(item) }
              : { label: 'Aktifkan', tone: 'success', onClick: () => void toggleActive(item) },
            { label: 'Hapus', tone: 'danger', onClick: () => void remove(item) },
          ]}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <AdminPageHead
        title="Hirarki Navigasi"
        desc="Visualisasi hirarki menu situs (View-Only) & pengelolaan tombol link dokumen perusahaan."
      />

      {error ? <p className="form-error">{error}</p> : null}

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid var(--line)', paddingBottom: 2 }}>
        <button
          type="button"
          onClick={() => setActiveTab('visual')}
          style={{
            padding: '10px 20px',
            border: 0,
            borderBottom: activeTab === 'visual' ? '3px solid var(--green)' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'visual' ? 'var(--green)' : 'var(--ink-soft)',
            fontWeight: activeTab === 'visual' ? 600 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            transition: 'all 0.2s var(--ease)',
          }}
        >
          <Icon name="compass" size={16} /> Viewer Visual Hirarki
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('docs')}
          style={{
            padding: '10px 20px',
            border: 0,
            borderBottom: activeTab === 'docs' ? '3px solid var(--green)' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'docs' ? 'var(--green)' : 'var(--ink-soft)',
            fontWeight: activeTab === 'docs' ? 600 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            transition: 'all 0.2s var(--ease)',
          }}
        >
          <Icon name="quote" size={16} /> Kelola Button Dokumen ({docLinks.filter((d) => d.active).length} Aktif)
        </button>
      </div>

      {/* TAB 1: VIEWER VISUAL HIRARKI (VIEW ONLY) */}
      {activeTab === 'visual' ? (
        <AdminCard
          title="Visual Hirarki Navigasi Company Profile"
          desc="Struktur navigasi utama di-render langsung dari arsitektur Next.js (View Only). Tombol dokumen aktif juga akan muncul di hirarki terkait."
        >
          <div style={{ display: 'grid', gap: 20, marginTop: 12 }}>
            {navTree.id.map((mainItem) => (
              <MainNavItemCard key={mainItem.label} mainItem={mainItem} docLinks={docLinks} />
            ))}
          </div>
        </AdminCard>
      ) : null}

      {/* TAB 2: KELOLA BUTTON DOKUMEN */}
      {activeTab === 'docs' ? (
        <AdminCard
          title="Pengaturan Dokumen & Link Button"
          desc="Kelola tombol link dokumen (seperti WBS, REACH Compliance, Company Profile) yang membuka dokumen saat diklik."
          action={{ label: 'Tambah Link Dokumen', icon: 'plus', onClick: openAdd }}
        >
          <DataTable
            columns={columns}
            rows={docLinks}
            empty={loading ? 'Memuat daftar dokumen...' : 'Belum ada link dokumen.'}
          />
        </AdminCard>
      ) : null}

      {/* MODAL FORM TAMBAH / EDIT DOKUMEN */}
      {formOpen ? (
        <div className="admin-modal-backdrop" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="admin-modal-head">
              <h2>{editingId ? 'Edit Link Dokumen' : 'Tambah Link Dokumen Baru'}</h2>
              <button type="button" className="admin-modal-close" onClick={closeForm}>
                ✕
              </button>
            </div>
            <form className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
              {formError ? <p className="form-error" role="alert">{formError}</p> : null}
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Judul Button / Dokumen</span>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Misal: Whistle Blowing System (WBS)"
                    required
                  />
                </label>
                <label>
                  <span className="field-label">Posisi Induk Menu</span>
                  <select
                    value={form.parentCategory}
                    onChange={(e) => setForm({ ...form, parentCategory: e.target.value })}
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                <span className="field-label">Deskripsi Singkat</span>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ringkasan atau keterangan dokumen"
                />
              </label>

              {/* MODE SELECTION */}
              <div style={{ marginBottom: 16 }}>
                <span className="field-label" style={{ display: 'block', marginBottom: 8 }}>Sumber Tautan Dokumen</span>
                <SegmentedRadio<'file' | 'url'>
                  name="docLinkMode"
                  value={form.linkMode}
                  onChange={(val) => setForm((prev) => ({ ...prev, linkMode: val }))}
                  options={[
                    { value: 'file', label: 'Upload File Dokumen (PDF / DOC)' },
                    { value: 'url', label: 'Tautan URL Web (https://...)' },
                  ]}
                />
              </div>

              {form.linkMode === 'file' ? (
                <label>
                  <span className="field-label">File Dokumen (PDF / DOCX)</span>
                  <FileUploadDropzone
                    accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    maxSizeMB={20}
                    selectedFile={selectedFile}
                    onFileSelect={(file) => {
                      setSelectedFile(file);
                      if (file) setForm((prev) => ({ ...prev, targetUrl: file.name }));
                    }}
                    activeFilePath={form.targetUrl}
                  />
                </label>
              ) : (
                <label>
                  <span className="field-label">Masukkan URL Web Target</span>
                  <input
                    type="url"
                    value={form.targetUrl}
                    onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                    placeholder="https://perusahaan.com/dokumen.pdf"
                    required={form.linkMode === 'url'}
                  />
                </label>
              )}

              <div className="admin-modal-actions" style={{ marginTop: 20 }}>
                <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>
                  Batal
                </button>
                <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Link Dokumen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
