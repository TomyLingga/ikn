'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column, type RowAction } from '@/components/admin/AdminPage';
import { I18nInput, firstError, slugify, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n, type PageData, type PageListItem } from '@/lib/cms';
import { formatDateTime } from '@/lib/format';
import { confirmDialog } from '@/components/ConfirmDialog';
import Select from '@/components/Select';

type PageStatus = PageListItem['status'];

interface NewPageForm {
  slug: string;
  slugTouched: boolean;
  title: I18n;
  status: PageStatus;
}

const emptyForm = (): NewPageForm => ({ slug: '', slugTouched: false, title: emptyI18n(), status: 'draft' });

// Page list: GET /admin/pages. Editing happens in /admin/pages/{id}.
export default function AdminPages() {
  const router = useRouter();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<PageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<NewPageForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<PageListItem[]>('/admin/pages'));
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

  async function setStatus(row: PageListItem, status: PageStatus) {
    setError('');
    try {
      await api(`/admin/pages/${row.id}`, { method: 'PUT', body: { status } });
      setNotice(status === 'published' ? t('Halaman diterbitkan.', 'Page published.') : t('Halaman dijadikan draf.', 'Page set to draft.'));
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: PageListItem) {
    const name = tr(row.title, lang);
    if (!await confirmDialog(t(`Hapus halaman "${name}" beserta semua section-nya?`, `Delete page "${name}" and all its sections?`))) return;
    setError('');
    try {
      await api(`/admin/pages/${row.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function openCreate() {
    setForm(emptyForm());
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    try {
      const created = await api<PageData>('/admin/pages', {
        method: 'POST',
        body: { slug: form.slug.trim(), title: form.title, status: form.status },
      });
      setFormOpen(false);
      router.push(`/admin/pages/${created.id}`);
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

  const columns: Column<PageListItem>[] = [
    {
      key: 'title',
      label: t('Judul', 'Title'),
      render: (p) => (
        <div>
          <strong>{p.title.id}</strong>
          {p.title.en && p.title.en !== p.title.id && (
            <small style={{ display: 'block', color: 'var(--ink-soft)', fontSize: '0.78rem' }}>{p.title.en}</small>
          )}
        </div>
      ),
    },
    {
      key: 'slug',
      label: 'Slug',
      render: (p) => (
        <span className="mono">
          /{p.slug === 'home' ? '' : p.slug}
          {p.isProtected && (
            <span className="cms-tag" title={t('Halaman bawaan situs', 'Built-in site page')}>
              {t('bawaan', 'built-in')}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (p) => (
        <StatusBadge
          label={p.status === 'published' ? t('Terbit', 'Published') : t('Draf', 'Draft')}
          tone={p.status === 'published' ? 'ok' : 'warn'}
          small
        />
      ),
    },
    { key: 'sectionCount', label: 'Section', align: 'right' },
    { key: 'updatedAt', label: t('Diperbarui', 'Updated'), render: (p) => formatDateTime(p.updatedAt, lang) },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (p) => {
        const actions: RowAction[] = [
          { label: 'Edit', onClick: () => router.push(`/admin/pages/${p.id}`) },
          p.status === 'published'
            ? { label: t('Jadikan draf', 'Unpublish'), tone: 'danger', onClick: () => void setStatus(p, 'draft') }
            : { label: t('Terbitkan', 'Publish'), tone: 'success', onClick: () => void setStatus(p, 'published') },
        ];
        if (!p.isProtected) actions.push({ label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void remove(p) });
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Halaman', 'Pages')}
        desc={t(
          'Kelola halaman situs dan susunan section-nya. Desain tiap section tetap mengikuti tema situs.',
          'Manage site pages and their sections. Section designs follow the site theme.',
        )}
        action={{ label: t('Halaman baru', 'New page'), icon: 'plus', onClick: openCreate }}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        defaultPageSize={20}
        empty={loading ? t('Memuat halaman...', 'Loading pages...') : t('Belum ada halaman.', 'No pages yet.')}
      />

      {formOpen && (
        <AdminModal title={t('Halaman baru', 'New page')} onClose={() => setFormOpen(false)} small>
          <form className="admin-form" onSubmit={(event) => void submit(event)}>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <I18nInput
              label={t('Judul halaman', 'Page title')}
              value={form.title}
              onChange={(title) =>
                setForm((current) => ({
                  ...current,
                  title,
                  slug: current.slugTouched ? current.slug : slugify(title.id),
                }))
              }
              required
              maxLength={200}
              errorId={firstError(formErrors, 'title.id', 'title')}
              errorEn={firstError(formErrors, 'title.en')}
            />
            <label>
              <span className="field-label">Slug</span>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value), slugTouched: true })}
                placeholder="mis. layanan-kami"
                required
                maxLength={128}
              />
              <small className="admin-field-hint">
                {t('Alamat halaman menjadi', 'The page address becomes')} /{form.slug || '...'}
              </small>
              {firstError(formErrors, 'slug') && <small className="cms-field-error">{firstError(formErrors, 'slug')}</small>}
            </label>
            <label>
              <span className="field-label">Status</span>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PageStatus })}>
                <option value="draft">{t('Draf', 'Draft')}</option>
                <option value="published">{t('Terbit', 'Published')}</option>
              </Select>
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setFormOpen(false)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : t('Buat & edit', 'Create & edit')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
