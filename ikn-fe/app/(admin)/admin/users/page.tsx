'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import PasswordChecklist from '@/components/PasswordChecklist';
import { emailError } from '@/lib/validation';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { AdminCard, AdminPageHead, DataTable, RowActions, type Column, type RowAction } from '@/components/admin/AdminPage';
import FileUploadDropzone, { SegmentedRadio } from '@/components/admin/FileUploadDropzone/FileUploadDropzone';
import { firstError, type FieldErrors } from '@/components/admin/cms';
import { api, ApiError, errorMessage } from '@/lib/api';
import { tr, type AdminUserData, type ModuleOption } from '@/lib/cms';
import { formatDateTime } from '@/lib/format';
import { confirmDialog } from '@/components/ConfirmDialog';
import Select from '@/components/Select';

type AdminRole = AdminUserData['role'];

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  permissions: string[];
  active: boolean;
}

const emptyForm = (): UserForm => ({ name: '', email: '', password: '', role: 'admin', permissions: [], active: true });

// GET/POST /admin/help-guide
interface HelpGuide {
  title: string;
  type: 'url' | 'file';
  url: string;
  file: { url: string; originalName: string } | null;
}

const defaultGuide = (): HelpGuide => ({ title: 'Panduan Admin', type: 'url', url: '', file: null });

// Admin accounts (super admin only) + help guide settings (module "users").
export default function AdminUsers() {
  const { admin } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const isSuperAdmin = admin?.role === 'super_admin';

  const [tab, setTab] = useState<'users' | 'guide'>(isSuperAdmin ? 'users' : 'guide');
  const [rows, setRows] = useState<AdminUserData[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [guide, setGuide] = useState<HelpGuide>(defaultGuide);
  const [guideFile, setGuideFile] = useState<File | null>(null);
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideError, setGuideError] = useState('');

  const refresh = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const [users, moduleList] = await Promise.all([
        api<AdminUserData[]>('/admin/users'),
        api<ModuleOption[]>('/admin/users/modules'),
      ]);
      setRows(users);
      setModules(moduleList);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  const loadGuide = useCallback(async () => {
    try {
      setGuide(await api<HelpGuide>('/admin/help-guide'));
    } catch (err) {
      setGuideError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadGuide();
  }, [refresh, loadGuide]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const moduleName = (code: string) => {
    const found = modules.find((m) => m.code === code);
    return found ? tr(found.name, lang) : code;
  };

  function openForm(user: AdminUserData | null) {
    setEditingId(user ? user.id : null);
    setForm(
      user
        ? {
            name: user.name,
            email: user.email,
            password: '',
            role: user.role,
            permissions: user.permissions.filter((p) => p !== '*'),
            active: user.active,
          }
        : emptyForm(),
    );
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  }

  function togglePermission(code: string) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(code)
        ? current.permissions.filter((p) => p !== code)
        : [...current.permissions, code],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      permissions: form.role === 'super_admin' ? [] : form.permissions,
      active: form.active,
    };
    if (form.password) body.password = form.password;
    try {
      if (editingId) {
        await api(`/admin/users/${editingId}`, { method: 'PUT', body });
      } else {
        if (!form.password) {
          setFormError(t('Kata sandi wajib diisi untuk akun baru.', 'Password is required for new accounts.'));
          return;
        }
        await api('/admin/users', { method: 'POST', body });
      }
      setFormOpen(false);
      setNotice(t('Akun tersimpan.', 'Account saved.'));
      await refresh();
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

  async function toggleActive(user: AdminUserData) {
    const question = user.active
      ? t(`Nonaktifkan akun ${user.name}?`, `Deactivate ${user.name}?`)
      : t(`Aktifkan akun ${user.name}?`, `Activate ${user.name}?`);
    if (!await confirmDialog(question)) return;
    setError('');
    try {
      await api(`/admin/users/${user.id}`, { method: 'PUT', body: { active: !user.active } });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveGuide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guideSaving) return;
    setGuideSaving(true);
    setGuideError('');
    try {
      const formData = new FormData();
      formData.append('title', guide.title);
      formData.append('type', guide.type);
      if (guide.type === 'url') formData.append('url', guide.url);
      if (guide.type === 'file' && guideFile) formData.append('file', guideFile);
      const saved = await api<HelpGuide>('/admin/help-guide', { method: 'POST', formData });
      setGuide(saved);
      setGuideFile(null);
      setNotice(t('Pengaturan petunjuk penggunaan tersimpan.', 'Help guide settings saved.'));
    } catch (err) {
      setGuideError(errorMessage(err));
    } finally {
      setGuideSaving(false);
    }
  }

  const columns: Column<AdminUserData>[] = [
    { key: 'name', label: t('Nama', 'Name'), render: (u) => <strong>{u.name}</strong> },
    { key: 'email', label: 'Email', render: (u) => <span className="mono">{u.email}</span> },
    { key: 'role', label: 'Role', render: (u) => (u.role === 'super_admin' ? 'Super Admin' : 'Admin') },
    {
      key: 'permissions',
      label: t('Modul akses', 'Modules'),
      render: (u) =>
        u.role === 'super_admin' || u.permissions.includes('*')
          ? t('Semua modul', 'All modules')
          : u.permissions.length > 0
            ? u.permissions.map(moduleName).join(', ')
            : '—',
    },
    { key: 'lastLoginAt', label: t('Login terakhir', 'Last login'), render: (u) => formatDateTime(u.lastLoginAt, lang) },
    {
      key: 'active',
      label: 'Status',
      render: (u) => <StatusBadge label={u.active ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={u.active ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (u) => {
        const isSelf = admin !== null && String(u.id) === admin.id;
        const actions: RowAction[] = [{ label: 'Edit', onClick: () => openForm(u) }];
        actions.push(
          u.active
            ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', disabled: isSelf, onClick: () => void toggleActive(u) }
            : { label: t('Aktifkan', 'Activate'), tone: 'success', onClick: () => void toggleActive(u) },
        );
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Akun Admin', 'Admin Accounts')}
        desc={t(
          'Kelola akun back-office, hak akses per modul, dan petunjuk penggunaan aplikasi.',
          'Manage back-office accounts, module permissions, and the application help guide.',
        )}
        action={tab === 'users' && isSuperAdmin ? { label: t('Tambah akun', 'Add account'), icon: 'plus', onClick: () => openForm(null) } : undefined}
      />

      <div className="admin-tabs">
        {isSuperAdmin && (
          <button type="button" className={`admin-tab${tab === 'users' ? ' is-active' : ''}`} onClick={() => setTab('users')}>
            <Icon name="users" size={15} /> {t('Akun admin', 'Admin accounts')}
          </button>
        )}
        <button type="button" className={`admin-tab${tab === 'guide' ? ' is-active' : ''}`} onClick={() => setTab('guide')}>
          <Icon name="compass" size={15} /> {t('Petunjuk penggunaan', 'Help guide')}
        </button>
      </div>

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      {tab === 'users' && isSuperAdmin && (
        <DataTable columns={columns} rows={rows} empty={loading ? t('Memuat akun...', 'Loading accounts...') : t('Belum ada akun admin.', 'No admin accounts yet.')} />
      )}

      {tab === 'guide' && (
        <AdminCard title={t('Petunjuk penggunaan aplikasi', 'Application help guide')}>
          <p className="admin-note" style={{ marginBottom: 18 }}>
            {t(
              'Dibuka saat admin mengklik "Petunjuk Penggunaan" di menu profil. Bisa berupa tautan URL atau dokumen (PDF).',
              'Opened when admins click "Help & User Manual" in the profile menu. Either a URL or an uploaded document (PDF).',
            )}
          </p>
          {guideError && (
            <p className="form-error" role="alert">
              {guideError}
            </p>
          )}
          <form className="admin-form" onSubmit={(event) => void saveGuide(event)} style={{ maxWidth: 720 }}>
            <label>
              <span className="field-label">{t('Judul petunjuk', 'Guide title')}</span>
              <input value={guide.title} onChange={(e) => setGuide({ ...guide, title: e.target.value })} required maxLength={150} />
            </label>
            <div>
              <span className="field-label" style={{ display: 'block', marginBottom: 8 }}>
                {t('Tipe sumber', 'Source type')}
              </span>
              <SegmentedRadio<'url' | 'file'>
                name="helpGuideType"
                value={guide.type}
                onChange={(type) => setGuide((current) => ({ ...current, type }))}
                options={[
                  { value: 'url', label: t('Tautan URL', 'URL link') },
                  { value: 'file', label: t('Unggah dokumen', 'Upload document') },
                ]}
              />
            </div>
            {guide.type === 'url' ? (
              <label>
                <span className="field-label">{t('Tautan URL', 'URL link')}</span>
                <input type="url" value={guide.url} onChange={(e) => setGuide({ ...guide, url: e.target.value })} placeholder="https://..." required />
              </label>
            ) : (
              <FileUploadDropzone
                label={t('Berkas petunjuk', 'Guide document')}
                accept=".pdf,application/pdf"
                selectedFile={guideFile}
                onFileSelect={setGuideFile}
                activeFilePath={guide.file?.url}
                activeFileName={guide.file?.originalName}
                helperText={t('Format PDF, maks. 10 MB.', 'PDF format, max. 10 MB.')}
              />
            )}
            <div>
              <button type="submit" className="btn btn-solid btn-sm" disabled={guideSaving}>
                {guideSaving ? t('Menyimpan...', 'Saving...') : t('Simpan petunjuk', 'Save help guide')}
              </button>
            </div>
          </form>
        </AdminCard>
      )}

      {formOpen && (
        <AdminModal title={editingId ? t('Edit akun admin', 'Edit admin account') : t('Tambah akun admin', 'Add admin account')} onClose={() => setFormOpen(false)}>
          <form className="admin-form" onSubmit={(event) => void submit(event)}>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Nama lengkap', 'Full name')}</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />
                {firstError(formErrors, 'name') && <small className="cms-field-error">{firstError(formErrors, 'name')}</small>}
              </label>
              <label>
                <span className="field-label">Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={190} aria-invalid={!!emailError(form.email, lang)} />
                {emailError(form.email, lang) && <small className="cms-field-error" role="alert">{emailError(form.email, lang)}</small>}
                {firstError(formErrors, 'email') && <small className="cms-field-error">{firstError(formErrors, 'email')}</small>}
              </label>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">
                  {t('Kata sandi', 'Password')}
                  {editingId ? ` (${t('kosongkan jika tidak diubah', 'leave blank to keep')})` : ''}
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingId}
                  minLength={8}
                  autoComplete="new-password"
                />
                {form.password && <PasswordChecklist value={form.password} />}
                {firstError(formErrors, 'password') && <small className="cms-field-error">{firstError(formErrors, 'password')}</small>}
              </label>
              <label>
                <span className="field-label">Role</span>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>
                  <option value="admin">{t('Admin (akses per modul)', 'Admin (per-module access)')}</option>
                  <option value="super_admin">{t('Super Admin (akses penuh)', 'Super Admin (full access)')}</option>
                </Select>
              </label>
            </div>
            {form.role === 'admin' && (
              <div>
                <span className="field-label" style={{ display: 'block', marginBottom: 8 }}>
                  {t('Hak akses modul', 'Module permissions')}
                </span>
                <div className="cms-check-grid">
                  {modules.map((m) => (
                    <label key={m.code} className="cms-check">
                      <input type="checkbox" checked={form.permissions.includes(m.code)} onChange={() => togglePermission(m.code)} />
                      <span>{tr(m.name, lang)}</span>
                    </label>
                  ))}
                </div>
                {firstError(formErrors, 'permissions') && <small className="cms-field-error">{firstError(formErrors, 'permissions')}</small>}
              </div>
            )}
            <label className="cms-check">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>{t('Akun aktif', 'Account active')}</span>
            </label>
            {firstError(formErrors, 'active') && <small className="cms-field-error">{firstError(formErrors, 'active')}</small>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setFormOpen(false)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : t('Simpan akun', 'Save account')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
