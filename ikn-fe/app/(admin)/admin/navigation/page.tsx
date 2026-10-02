'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminCard, AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { SegmentedRadio } from '@/components/admin/FileUploadDropzone/FileUploadDropzone';
import { I18nInput, MediaPicker, MenuEditor, firstError, menuPayload, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type DocLinkData, type I18n, type MediaSummary, type MenuData, type MenuNode } from '@/lib/cms';
import { confirmDialog } from '@/components/ConfirmDialog';
import Select from '@/components/Select';
import { FileLink } from '@/components/FileViewer';

type MenuLocation = 'header' | 'footer';

interface DocLinkForm {
  category: string;
  label: I18n;
  description: I18n;
  mode: 'file' | 'url';
  file: MediaSummary | null;
  url: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyDocForm = (category: string): DocLinkForm => ({
  category,
  label: emptyI18n(),
  description: emptyI18n(),
  mode: 'file',
  file: null,
  url: '',
  isActive: true,
  sortOrder: 0,
});

function docFormFromRow(row: DocLinkData): DocLinkForm {
  return {
    category: row.category,
    label: row.label,
    description: row.description ?? emptyI18n(),
    mode: row.file || !row.url ? 'file' : 'url',
    file: row.file,
    url: row.url ?? '',
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

// DocLinkRequest replaces every field on update, so always send the full record.
function docPayload(form: DocLinkForm) {
  return {
    category: form.category,
    label: form.label,
    description: form.description,
    mediaId: form.mode === 'file' ? form.file?.id ?? null : null,
    url: form.mode === 'url' ? form.url.trim() || null : null,
    isActive: form.isActive,
    sortOrder: form.sortOrder,
  };
}

// Navigation: header/footer menu trees (PUT whole tree) and document links (CRUD).
export default function AdminNavigation() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [menus, setMenus] = useState<Record<MenuLocation, MenuNode[]>>({ header: [], footer: [] });
  const [menuTab, setMenuTab] = useState<MenuLocation>('header');
  const [menuErrors, setMenuErrors] = useState<FieldErrors>({});
  const [menuError, setMenuError] = useState('');
  const [savingMenu, setSavingMenu] = useState(false);
  const [dirty, setDirty] = useState<Record<MenuLocation, boolean>>({ header: false, footer: false });

  const [docLinks, setDocLinks] = useState<DocLinkData[]>([]);
  const [docFormOpen, setDocFormOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [docForm, setDocForm] = useState<DocLinkForm>(() => emptyDocForm('wbs'));
  const [docErrors, setDocErrors] = useState<FieldErrors>({});
  const [docError, setDocError] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [header, footer, links] = await Promise.all([
        api<MenuData>('/admin/menus/header'),
        api<MenuData>('/admin/menus/footer'),
        api<DocLinkData[]>('/admin/navigation/doc-links'),
      ]);
      setMenus({ header: header.items, footer: footer.items });
      setDirty({ header: false, footer: false });
      setDocLinks(links);
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

  // Doc-link categories: header top-level keys plus the fixed "wbs" category.
  const categories = useMemo(() => {
    const keys = menus.header.map((item) => item.key?.trim() ?? '').filter((key) => key !== '');
    return Array.from(new Set([...keys, 'wbs']));
  }, [menus.header]);

  function updateMenu(location: MenuLocation, items: MenuNode[]) {
    setMenus((current) => ({ ...current, [location]: items }));
    setDirty((current) => ({ ...current, [location]: true }));
  }

  async function saveMenu(location: MenuLocation) {
    if (savingMenu) return;
    setSavingMenu(true);
    setMenuError('');
    setMenuErrors({});
    try {
      const saved = await api<MenuData>(`/admin/menus/${location}`, {
        method: 'PUT',
        body: { items: menuPayload(menus[location], location === 'header') },
      });
      setMenus((current) => ({ ...current, [location]: saved.items }));
      setDirty((current) => ({ ...current, [location]: false }));
      setNotice(location === 'header' ? t('Menu header tersimpan.', 'Header menu saved.') : t('Menu footer tersimpan.', 'Footer menu saved.'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setMenuErrors(err.errors);
        setMenuError(err.message);
      } else {
        setMenuError(errorMessage(err));
      }
    } finally {
      setSavingMenu(false);
    }
  }

  function openDocForm(row: DocLinkData | null) {
    setEditingDocId(row ? row.id : null);
    setDocForm(row ? docFormFromRow(row) : { ...emptyDocForm(categories[0] ?? 'wbs'), sortOrder: docLinks.length });
    setDocErrors({});
    setDocError('');
    setDocFormOpen(true);
  }

  function closeDocForm() {
    setDocFormOpen(false);
    setEditingDocId(null);
  }

  async function submitDoc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingDoc) return;
    setSavingDoc(true);
    setDocError('');
    setDocErrors({});
    try {
      if (editingDocId) {
        await api(`/admin/navigation/doc-links/${editingDocId}`, { method: 'PUT', body: docPayload(docForm) });
      } else {
        await api('/admin/navigation/doc-links', { method: 'POST', body: docPayload(docForm) });
      }
      setDocLinks(await api<DocLinkData[]>('/admin/navigation/doc-links'));
      closeDocForm();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setDocErrors(err.errors);
        setDocError(err.message);
      } else {
        setDocError(errorMessage(err));
      }
    } finally {
      setSavingDoc(false);
    }
  }

  async function toggleDoc(row: DocLinkData) {
    setError('');
    try {
      await api(`/admin/navigation/doc-links/${row.id}`, {
        method: 'PUT',
        body: docPayload({ ...docFormFromRow(row), isActive: !row.isActive }),
      });
      setDocLinks(await api<DocLinkData[]>('/admin/navigation/doc-links'));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeDoc(row: DocLinkData) {
    if (!await confirmDialog(t(`Hapus tautan dokumen "${tr(row.label, lang)}"?`, `Delete document link "${tr(row.label, lang)}"?`))) return;
    setError('');
    try {
      await api(`/admin/navigation/doc-links/${row.id}`, { method: 'DELETE' });
      setDocLinks(await api<DocLinkData[]>('/admin/navigation/doc-links'));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const docColumns: Column<DocLinkData>[] = [
    {
      key: 'label',
      label: t('Tautan dokumen', 'Document link'),
      render: (d) => (
        <div>
          <strong>{tr(d.label, lang)}</strong>
          {d.description && tr(d.description, lang) && (
            <small style={{ display: 'block', color: 'var(--ink-soft)', fontSize: '0.78rem' }}>{tr(d.description, lang)}</small>
          )}
        </div>
      ),
    },
    { key: 'category', label: t('Kategori', 'Category'), render: (d) => <span className="cms-tag">{d.category}</span> },
    {
      key: 'target',
      label: t('Target', 'Target'),
      render: (d) =>
        d.targetUrl ? (
          d.file ? (
            <FileLink file={{ url: d.file.url, name: d.file.originalName, mime: d.file.mime }} className="cms-link mono">
              {d.file.originalName}
            </FileLink>
          ) : (
            <a href={d.targetUrl} target="_blank" rel="noopener noreferrer" className="cms-link mono">
              {d.targetUrl}
            </a>
          )
        ) : (
          '—'
        ),
    },
    { key: 'sortOrder', label: t('Urutan', 'Order'), align: 'right' },
    {
      key: 'isActive',
      label: 'Status',
      render: (d) => <StatusBadge label={d.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={d.isActive ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (d) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openDocForm(d) },
            d.isActive
              ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', onClick: () => void toggleDoc(d) }
              : { label: t('Aktifkan', 'Activate'), tone: 'success', onClick: () => void toggleDoc(d) },
            { label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void removeDoc(d) },
          ]}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <AdminPageHead
        title={t('Menu Navigasi', 'Navigation')}
        desc={t(
          'Susunan menu header (dua tingkat) dan footer, serta tautan dokumen yang muncul di menu.',
          'Header (two levels) and footer menu structure, plus document links shown in the menus.',
        )}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <AdminCard
        title={t('Struktur menu', 'Menu structure')}
        desc={t('Perubahan disimpan sekaligus per lokasi menu.', 'Changes are saved as a whole per menu location.')}
      >
        <div className="admin-tabs">
          {(['header', 'footer'] as MenuLocation[]).map((location) => (
            <button
              key={location}
              type="button"
              className={`admin-tab${menuTab === location ? ' is-active' : ''}`}
              onClick={() => setMenuTab(location)}
            >
              {location === 'header' ? t('Menu header', 'Header menu') : t('Menu footer', 'Footer menu')}
              {dirty[location] ? ' •' : ''}
            </button>
          ))}
        </div>

        {menuError && (
          <p className="form-error" role="alert">
            {menuError}
          </p>
        )}

        {loading ? (
          <div className="admin-empty">{t('Memuat menu...', 'Loading menus...')}</div>
        ) : (
          <div className="admin-form">
            <MenuEditor
              key={menuTab}
              items={menus[menuTab]}
              onChange={(items) => updateMenu(menuTab, items)}
              allowChildren={menuTab === 'header'}
              errors={menuErrors}
              lang={lang}
            />
            <div className="admin-card-foot">
              <button type="button" className="btn btn-solid btn-sm" disabled={savingMenu || !dirty[menuTab]} onClick={() => void saveMenu(menuTab)}>
                {savingMenu ? t('Menyimpan...', 'Saving...') : menuTab === 'header' ? t('Simpan menu header', 'Save header menu') : t('Simpan menu footer', 'Save footer menu')}
              </button>
              <button type="button" className="btn btn-line btn-sm" disabled={savingMenu || !dirty[menuTab]} onClick={() => void load()}>
                {t('Batalkan perubahan', 'Discard changes')}
              </button>
            </div>
          </div>
        )}
      </AdminCard>

      <AdminCard
        title={t('Tautan dokumen', 'Document links')}
        desc={t(
          'Tombol dokumen (PDF atau URL) yang muncul di bawah menu induk sesuai kategori. Kategori "wbs" dipakai halaman WBS.',
          'Document buttons (PDF or URL) shown under the parent menu by category. The "wbs" category is used by the WBS page.',
        )}
        action={{ label: t('Tambah tautan', 'Add link'), icon: 'plus', onClick: () => openDocForm(null) }}
      >
        <DataTable columns={docColumns} rows={docLinks} empty={loading ? t('Memuat...', 'Loading...') : t('Belum ada tautan dokumen.', 'No document links yet.')} />
      </AdminCard>

      {docFormOpen && (
        <AdminModal title={editingDocId ? t('Edit tautan dokumen', 'Edit document link') : t('Tambah tautan dokumen', 'Add document link')} onClose={closeDocForm} width={880}>
          <form className="admin-form" onSubmit={(event) => void submitDoc(event)}>
            {docError && (
              <p className="form-error" role="alert">
                {docError}
              </p>
            )}
            <I18nInput
              label="Label"
              value={docForm.label}
              onChange={(label) => setDocForm({ ...docForm, label })}
              required
              maxLength={150}
              errorId={firstError(docErrors, 'label.id', 'label')}
              errorEn={firstError(docErrors, 'label.en')}
            />
            <I18nInput
              label={t('Deskripsi singkat', 'Short description')}
              value={docForm.description}
              onChange={(description) => setDocForm({ ...docForm, description })}
              maxLength={300}
              errorId={firstError(docErrors, 'description.id')}
              errorEn={firstError(docErrors, 'description.en')}
            />
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Kategori (menu induk)', 'Category (parent menu)')}</span>
                <Select value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}>
                  {!categories.includes(docForm.category) && <option value={docForm.category}>{docForm.category}</option>}
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
                {firstError(docErrors, 'category') && <small className="cms-field-error">{firstError(docErrors, 'category')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Urutan', 'Sort order')}</span>
                <input type="number" min={0} value={docForm.sortOrder} onChange={(e) => setDocForm({ ...docForm, sortOrder: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <div>
              <span className="field-label" style={{ display: 'block', marginBottom: 8 }}>
                {t('Sumber tautan', 'Link source')}
              </span>
              <SegmentedRadio<'file' | 'url'>
                name="docLinkMode"
                value={docForm.mode}
                onChange={(mode) => setDocForm((current) => ({ ...current, mode }))}
                options={[
                  { value: 'file', label: t('Berkas dokumen (PDF)', 'Document file (PDF)') },
                  { value: 'url', label: t('Tautan URL', 'Web URL') },
                ]}
              />
            </div>
            {docForm.mode === 'file' ? (
              <MediaPicker
                label={t('Berkas dokumen', 'Document file')}
                value={docForm.file}
                onChange={(file) => setDocForm({ ...docForm, file })}
                accept="document"
                collection="documents"
                error={firstError(docErrors, 'mediaId')}
              />
            ) : (
              <label>
                <span className="field-label">URL</span>
                <input value={docForm.url} onChange={(e) => setDocForm({ ...docForm, url: e.target.value })} placeholder="https://..." maxLength={500} required />
                {firstError(docErrors, 'url') && <small className="cms-field-error">{firstError(docErrors, 'url')}</small>}
              </label>
            )}
            <label className="cms-check">
              <input type="checkbox" checked={docForm.isActive} onChange={(e) => setDocForm({ ...docForm, isActive: e.target.checked })} />
              <span>{t('Aktif (tampil di menu)', 'Active (shown in menu)')}</span>
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={closeDocForm}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={savingDoc}>
                {savingDoc ? t('Menyimpan...', 'Saving...') : editingDocId ? t('Simpan perubahan', 'Save changes') : t('Tambah tautan', 'Add link')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
