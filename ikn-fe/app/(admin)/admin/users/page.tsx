'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import SessionLoader from '@/components/SessionLoader';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { AdminCard, AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import FileUploadDropzone, { SegmentedRadio } from '@/components/admin/FileUploadDropzone/FileUploadDropzone';
import { api, errorMessage } from '@/lib/api';
import type { AdminUser } from '@/lib/types';

const permissionList: [string, string][] = [
  ['orders', 'Order'],
  ['payments', 'Payment'],
  ['products', 'Produk'],
  ['categories', 'Kategori'],
  ['customers', 'Customer'],
  ['bank', 'Rekening Bank'],
  ['fees', 'Biaya Tambahan'],
  ['reports', 'Laporan'],
  ['menu', 'Menu'],
  ['content', 'Konten'],
  ['news', 'Berita'],
  ['gallery', 'Galeri'],
  ['wbs', 'WBS'],
];

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: 'super_admin' | 'admin';
  permissions: string[];
  active: boolean;
}

const emptyForm: UserForm = {
  name: '',
  email: '',
  password: '',
  role: 'admin',
  permissions: [],
  active: true,
};

interface HelpGuideConfig {
  title: string;
  type: 'url' | 'file';
  url: string;
  filePath: string;
  fileName: string;
}

export default function AdminUsers() {
  const { admin, ready } = useAuth();
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState<'users' | 'guide'>('users');
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Help Guide Config State (Super Admin Only)
  const [guide, setGuide] = useState<HelpGuideConfig>({
    title: 'Petunjuk Penggunaan Aplikasi Back-office PT IKN',
    type: 'url',
    url: '',
    filePath: '',
    fileName: '',
  });
  const [guideFile, setGuideFile] = useState<File | null>(null);
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideNotice, setGuideNotice] = useState('');
  const [guideError, setGuideError] = useState('');

  const isSuperAdmin = admin?.role === 'super_admin';

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [usersData, guideData] = await Promise.all([
        api<AdminUser[]>('/admin/users'),
        api<HelpGuideConfig>('/admin/help-guide').catch(() => null),
      ]);
      setRows(usersData);
      if (guideData) setGuide(guideData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void refresh();
  }, [isSuperAdmin, refresh]);

  if (!ready) {
    return <SessionLoader message={lang === 'en' ? 'Checking access rights...' : 'Memeriksa hak akses...'} />;
  }

  if (!isSuperAdmin) {
    return (
      <div>
        <AdminPageHead title={lang === 'en' ? 'Admin Accounts' : 'Akun Admin'} />
        <p className="admin-note" style={{ color: 'var(--red)' }}>
          {lang === 'en'
            ? 'Access restricted. Only Super Admin can manage accounts and system settings.'
            : 'Akses terbatas. Hanya Super Admin yang dapat mengelola akun dan pengaturan sistem.'}
        </p>
      </div>
    );
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditingId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      permissions: user.permissions || [],
      active: user.active,
    });
    setFormError('');
    setFormOpen(true);
  }

  function togglePermission(perm: string) {
    setForm((prev) => {
      const has = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: has ? prev.permissions.filter((p) => p !== perm) : [...prev.permissions, perm],
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      if (editingId) {
        await api(`/admin/users/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          body: {
            name: form.name,
            email: form.email,
            password: form.password || undefined,
            role: form.role,
            permissions: form.role === 'super_admin' ? [] : form.permissions,
            active: form.active,
          },
        });
      } else {
        if (!form.password) {
          setFormError(lang === 'en' ? 'Password is required for new accounts.' : 'Kata sandi wajib diisi untuk akun baru.');
          setSaving(false);
          return;
        }
        await api('/admin/users', {
          method: 'POST',
          body: {
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            permissions: form.role === 'super_admin' ? [] : form.permissions,
            active: form.active,
          },
        });
      }

      setFormOpen(false);
      await refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: AdminUser) {
    if (!window.confirm(
      lang === 'en'
        ? `Are you sure you want to ${user.active ? 'deactivate' : 'activate'} ${user.name}?`
        : `Yakin ingin ${user.active ? 'menonaktifkan' : 'mengaktifkan'} ${user.name}?`
    )) {
      return;
    }
    try {
      await api(`/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        body: { active: !user.active },
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleGuideSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuideSaving(true);
    setGuideError('');
    setGuideNotice('');
    try {
      const formData = new FormData();
      formData.append('title', guide.title);
      formData.append('type', guide.type);
      if (guide.type === 'url') {
        formData.append('url', guide.url);
      }
      if (guide.type === 'file' && guideFile) {
        formData.append('file', guideFile);
      }

      await api('/admin/help-guide', {
        method: 'POST',
        formData,
      });

      setGuideNotice(lang === 'en' ? 'Help guide settings saved successfully!' : 'Pengaturan petunjuk penggunaan berhasil disimpan!');
      setGuideFile(null);
      await refresh();
    } catch (err) {
      setGuideError(errorMessage(err));
    } finally {
      setGuideSaving(false);
    }
  }

  const columns: Column<AdminUser>[] = [
    { key: 'name', label: lang === 'en' ? 'Name' : 'Nama' },
    { key: 'email', label: 'Email', render: (u) => <span className="mono">{u.email}</span> },
    {
      key: 'role',
      label: 'Role',
      render: (u) => (u.role === 'super_admin' ? 'Super Admin' : 'Admin Staff'),
    },
    {
      key: 'permissions',
      label: lang === 'en' ? 'Access Modules' : 'Modul Akses',
      render: (user) =>
        user.role === 'super_admin'
          ? (lang === 'en' ? 'All modules (Super Admin)' : 'Semua modul (Super Admin)')
          : (user.permissions || []).length > 0
          ? (user.permissions || []).join(', ')
          : '—',
    },
    {
      key: 'active',
      label: 'Status',
      render: (user) => (
        <StatusBadge
          label={
            user.active
              ? lang === 'en' ? 'Active' : 'Aktif'
              : lang === 'en' ? 'Inactive' : 'Nonaktif'
          }
          tone={user.active ? 'ok' : 'bad'}
          small
        />
      ),
    },
    {
      key: 'act',
      label: lang === 'en' ? 'Action' : 'Aksi',
      render: (user) => (
        <RowActions
          actions={[
            { label: lang === 'en' ? 'Edit' : 'Edit', onClick: () => openEdit(user) },
            user.active
              ? { label: lang === 'en' ? 'Deactivate' : 'Nonaktifkan', tone: 'danger', onClick: () => void toggleActive(user) }
              : { label: lang === 'en' ? 'Activate' : 'Aktifkan', tone: 'success', onClick: () => void toggleActive(user) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={lang === 'en' ? 'Admin Accounts & System Settings' : 'Akun Admin & Pengaturan Sistem'}
        desc={
          lang === 'en'
            ? 'Manage back-office accounts, module permissions, and application help guide.'
            : 'Kelola akun pengelola back-office, hak akses per modul, dan petunjuk penggunaan aplikasi.'
        }
        action={
          activeTab === 'users'
            ? {
                label: lang === 'en' ? 'Add Account' : 'Tambah akun',
                icon: 'plus',
                onClick: openAdd,
              }
            : undefined
        }
      />

      {/* 2 TOMBOL TERPISAH DI MENU SETTINGS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'users' ? 'btn-solid' : 'btn-line'}`}
          onClick={() => setActiveTab('users')}
          style={{ gap: 8 }}
        >
          <Icon name="users" size={17} />
          {lang === 'en' ? 'Manage Admin Users' : 'Kelola User / Akun Admin'}
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'guide' ? 'btn-solid' : 'btn-line'}`}
          onClick={() => setActiveTab('guide')}
          style={{ gap: 8 }}
        >
          <Icon name="compass" size={17} />
          {lang === 'en' ? 'Help Guide Settings' : 'Pengaturan Petunjuk Penggunaan'}
        </button>
      </div>

      {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}

      {/* TAB 1: KELOLA USER / AKUN ADMIN */}
      {activeTab === 'users' && (
        <div>
          <DataTable
            columns={columns}
            rows={rows}
            empty={
              loading
                ? lang === 'en' ? 'Loading accounts...' : 'Memuat akun...'
                : lang === 'en' ? 'No admin accounts available.' : 'Akun admin belum tersedia.'
            }
          />
        </div>
      )}

      {/* TAB 2: PENGATURAN PETUNJUK PENGGUNAAN */}
      {activeTab === 'guide' && (
        <div>
          <AdminCard title={lang === 'en' ? 'Help Guide & Usage Manual Settings' : 'Pengaturan Petunjuk Penggunaan Aplikasi'}>
            <p className="admin-note" style={{ marginBottom: 18 }}>
              {lang === 'en'
                ? 'Configure the help guide opened when admins click "Petunjuk Penggunaan" in the profile menu. You can set a URL link or upload a document (PDF, DOCX, PPT).'
                : 'Atur petunjuk penggunaan yang akan muncul saat admin mengklik tombol "Petunjuk Penggunaan" di menu profil. Bisa berupa tautan URL atau dokumen (PDF, DOCX, PPT).'}
            </p>

            {guideNotice && (
              <div className="admin-toast" role="status" style={{ marginBottom: 18 }}>
                {guideNotice}
              </div>
            )}
            {guideError && <p className="form-error" role="alert" style={{ marginBottom: 18 }}>{guideError}</p>}

            <form className="admin-form" onSubmit={(e) => void handleGuideSave(e)}>
              <div>
                <label>
                  <span className="field-label">{lang === 'en' ? 'Guide Title' : 'Judul Petunjuk'}</span>
                  <input
                    value={guide.title}
                    onChange={(e) => setGuide({ ...guide, title: e.target.value })}
                    placeholder="Contoh: Petunjuk Penggunaan Back-office PT IKN"
                    required
                  />
                </label>
              </div>

              <div style={{ marginTop: 14 }}>
                <span className="field-label" style={{ display: 'block', marginBottom: 8 }}>
                  {lang === 'en' ? 'Guide Source Type' : 'Tipe Sumber Petunjuk'}
                </span>
                <SegmentedRadio<'file' | 'url'>
                  name="helpGuideSourceType"
                  value={guide.type}
                  onChange={(val) => setGuide({ ...guide, type: val })}
                  options={[
                    { value: 'url', label: lang === 'en' ? 'URL Link (Web / Drive)' : 'Tautan URL (Web / Drive)' },
                    { value: 'file', label: lang === 'en' ? 'Upload Document File' : 'Unggah Dokumen (PDF, DOCX, PPT)' },
                  ]}
                />
              </div>

              {guide.type === 'url' ? (
                <label style={{ marginTop: 14 }}>
                  <span className="field-label">{lang === 'en' ? 'Help Guide URL Link' : 'Tautan URL Petunjuk'}</span>
                  <input
                    type="url"
                    value={guide.url}
                    onChange={(e) => setGuide({ ...guide, url: e.target.value })}
                    placeholder="https://example.com/petunjuk-penggunaan.pdf"
                    required={guide.type === 'url'}
                  />
                </label>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <FileUploadDropzone
                    label={lang === 'en' ? 'Upload Document File' : 'Unggah File Dokumen Petunjuk'}
                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                    selectedFile={guideFile}
                    onFileSelect={(file) => setGuideFile(file)}
                    activeFilePath={guide.filePath}
                    activeFileName={guide.fileName}
                    helperText={lang === 'en' ? 'Supported formats: PDF, DOCX, PPT, PPTX (Max 20MB)' : 'Format didukung: PDF, DOCX, PPT, PPTX (Maks 20MB)'}
                  />
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <button type="submit" className="btn btn-solid btn-sm" disabled={guideSaving}>
                  {guideSaving
                    ? lang === 'en' ? 'Saving...' : 'Menyimpan...'
                    : lang === 'en' ? 'Save Help Guide Settings' : 'Simpan Pengaturan Petunjuk'}
                </button>
              </div>
            </form>
          </AdminCard>
        </div>
      )}

      {/* MODAL FORM TAMBAH / EDIT AKUN ADMIN */}
      {formOpen && (
        <div className="admin-modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>
                {editingId
                  ? lang === 'en' ? 'Edit Admin Account' : 'Edit Akun Admin'
                  : lang === 'en' ? 'Add New Admin Account' : 'Tambah Akun Admin Baru'}
              </h2>
              <button type="button" className="admin-modal-close" onClick={() => setFormOpen(false)}>
                ✕
              </button>
            </div>

            {formError && <p className="form-error">{formError}</p>}

            <form onSubmit={(e) => void handleSubmit(e)}>
              <div className="admin-form">
                <label>
                  <span className="field-label">{lang === 'en' ? 'Full Name' : 'Nama Lengkap'}</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </label>

                <label>
                  <span className="field-label">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </label>

                <label>
                  <span className="field-label">
                    {lang === 'en' ? 'Password' : 'Kata Sandi'}
                    {editingId && (
                      <span style={{ fontWeight: 'normal', color: 'var(--ink-soft)', marginLeft: 6 }}>
                        ({lang === 'en' ? 'leave blank if unchanged' : 'kosongkan jika tidak diubah'})
                      </span>
                    )}
                  </span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required={!editingId}
                  />
                </label>

                <label>
                  <span className="field-label">Role</span>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        role: e.target.value as 'super_admin' | 'admin',
                      })
                    }
                  >
                    <option value="admin">Admin Staff (Akses Terbatas)</option>
                    <option value="super_admin">Super Admin (Akses Penuh)</option>
                  </select>
                </label>

                {form.role === 'admin' && (
                  <div>
                    <span className="field-label" style={{ display: 'block', marginBottom: 8 }}>
                      {lang === 'en' ? 'Module Permissions' : 'Hak Akses Modul'}
                    </span>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: 8,
                      }}
                    >
                      {permissionList.map(([key, label]) => {
                        const checked = form.permissions.includes(key);
                        return (
                          <label
                            key={key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: '0.84rem',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(key)}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={() => setFormOpen(false)}>
                  {lang === 'en' ? 'Cancel' : 'Batal'}
                </button>
                <button type="button" className="btn btn-solid btn-sm" disabled={saving} onClick={(e) => {
                  const formEl = e.currentTarget.closest('div')?.previousElementSibling as HTMLFormElement;
                  if (formEl) formEl.requestSubmit();
                }}>
                  {saving
                    ? lang === 'en' ? 'Saving...' : 'Menyimpan...'
                    : lang === 'en' ? 'Save Account' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
