'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminCard, AdminPageHead } from '@/components/admin/AdminPage';
import { I18nInput, SectionForm, firstError, toI18n, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import {
  tr,
  type I18n,
  type PageData,
  type PageSection,
  type SectionContent,
  type SectionTypeDef,
  type SectionTypesResponse,
} from '@/lib/cms';
import { formatDateTime } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { confirmDialog } from '@/components/ConfirmDialog';
import Select from '@/components/Select';

type PageStatus = PageData['status'];

interface MetaForm {
  slug: string;
  status: PageStatus;
  title: I18n;
  seoTitle: I18n;
  seoDescription: I18n;
}

function metaFromPage(page: PageData): MetaForm {
  return {
    slug: page.slug,
    status: page.status,
    title: toI18n(page.title),
    seoTitle: toI18n(page.seo?.title),
    seoDescription: toI18n(page.seo?.description),
  };
}

/** Short preview for a section card: first non-empty translatable field or list size. */
function summarize(def: SectionTypeDef | undefined, content: SectionContent, lang: Lang): string {
  if (!def) return '';
  for (const [key, field] of Object.entries(def.fields)) {
    if (field.type === 'i18n_text' || field.type === 'i18n_textarea' || field.type === 'i18n_richtext') {
      const text = tr(toI18n(content[key]), lang).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text) return text.length > 90 ? `${text.slice(0, 90)}…` : text;
    }
    if (field.type === 'list' && Array.isArray(content[key])) {
      return `${(content[key] as unknown[]).length} item`;
    }
  }
  return '';
}

// Page editor: meta card (PUT /admin/pages/{id}) + ordered section cards with
// visibility, reorder, delete, and schema-driven content forms.
export default function AdminPageEditor({ params }: { params: { id: string } }) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const pageId = Number(params.id);

  const [page, setPage] = useState<PageData | null>(null);
  const [types, setTypes] = useState<SectionTypesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [meta, setMeta] = useState<MetaForm | null>(null);
  const [metaErrors, setMetaErrors] = useState<FieldErrors>({});
  const [metaError, setMetaError] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [editing, setEditing] = useState<PageSection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [typeQuery, setTypeQuery] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [pageData, typeData] = await Promise.all([
        api<PageData>(`/admin/pages/${pageId}`),
        api<SectionTypesResponse>('/admin/cms/section-types'),
      ]);
      setPage(pageData);
      setMeta(metaFromPage(pageData));
      setTypes(typeData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function replaceSection(section: PageSection) {
    setPage((current) =>
      current ? { ...current, sections: current.sections.map((s) => (s.id === section.id ? section : s)) } : current,
    );
  }

  async function saveMeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || !meta || savingMeta) return;
    setSavingMeta(true);
    setMetaError('');
    setMetaErrors({});
    const body: Record<string, unknown> = {
      title: meta.title,
      status: meta.status,
      seo: { title: meta.seoTitle, description: meta.seoDescription },
    };
    if (!page.isProtected && meta.slug.trim() !== page.slug) body.slug = meta.slug.trim();
    try {
      const updated = await api<PageData>(`/admin/pages/${page.id}`, { method: 'PUT', body });
      setPage(updated);
      setMeta(metaFromPage(updated));
      setNotice(t('Pengaturan halaman tersimpan.', 'Page settings saved.'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setMetaErrors(err.errors);
        setMetaError(err.message);
      } else {
        setMetaError(errorMessage(err));
      }
    } finally {
      setSavingMeta(false);
    }
  }

  async function toggleVisible(section: PageSection) {
    setBusy(section.id);
    setError('');
    try {
      const updated = await api<PageSection>(`/admin/sections/${section.id}`, {
        method: 'PUT',
        body: { isVisible: !section.isVisible },
      });
      replaceSection(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!page) return;
    const target = index + direction;
    if (target < 0 || target >= page.sections.length) return;
    const ids = page.sections.map((s) => s.id);
    const [id] = ids.splice(index, 1);
    if (id === undefined) return;
    ids.splice(target, 0, id);
    setBusy(id);
    setError('');
    try {
      const updated = await api<PageData>(`/admin/pages/${page.id}/sections/reorder`, { method: 'PUT', body: { ids } });
      setPage({ ...updated, isProtected: page.isProtected });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function removeSection(section: PageSection) {
    const def = types?.types[section.type];
    const name = def ? tr(def.name, lang) : section.type;
    if (!await confirmDialog(t(`Hapus section "${name}"? Isinya tidak bisa dikembalikan.`, `Delete section "${name}"? Its content cannot be restored.`))) return;
    setBusy(section.id);
    setError('');
    try {
      await api(`/admin/sections/${section.id}`, { method: 'DELETE' });
      setPage((current) => (current ? { ...current, sections: current.sections.filter((s) => s.id !== section.id) } : current));
      setNotice(t('Section dihapus.', 'Section deleted.'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  // Pemilih tipe: dikelompokkan menurut `groups` dari API (urutan API), disaring kata kunci;
  // di dalam kelompok, tipe yang disarankan untuk halaman ini (petunjuk `pages`) tampil lebih dulu.
  const typeGroups = useMemo(() => {
    if (!types || !page) return [];
    const groups = types.groups ?? {};
    const query = typeQuery.trim().toLowerCase();
    const buckets = new Map<string, Array<[string, SectionTypeDef]>>();
    for (const [type, def] of Object.entries(types.types)) {
      if (query && !`${tr(def.name, lang)} ${tr(def.description, lang)} ${type}`.toLowerCase().includes(query)) continue;
      const key = def.group && groups[def.group] ? def.group : 'other';
      buckets.set(key, [...(buckets.get(key) ?? []), [type, def]]);
    }
    const rank = (def: SectionTypeDef) => (def.pages.includes(page.slug) ? 0 : 1);
    return [...Object.keys(groups), 'other'].flatMap((key) => {
      const items = buckets.get(key);
      if (!items) return [];
      const group = groups[key];
      return [{ key, label: group ? tr(group, lang) : lang === 'en' ? 'Other' : 'Lainnya', items: items.slice().sort((a, b) => rank(a[1]) - rank(b[1])) }];
    });
  }, [types, page, typeQuery, lang]);

  if (loading) {
    return <div className="admin-empty">{t('Memuat halaman...', 'Loading page...')}</div>;
  }

  if (!page || !meta) {
    return (
      <div>
        <AdminPageHead title={t('Halaman', 'Page')} />
        <p className="form-error">{error || t('Halaman tidak ditemukan.', 'Page not found.')}</p>
        <Link href="/admin/pages" className="btn btn-line btn-sm">
          {t('Kembali ke daftar halaman', 'Back to pages')}
        </Link>
      </div>
    );
  }

  const publicHref = page.slug === 'home' ? '/' : `/${page.slug}`;
  const editingDef = editing && types ? types.types[editing.type] : undefined;
  const creatingDef = creating && types ? types.types[creating] : undefined;

  return (
    <div>
      <AdminPageHead
        title={tr(page.title, lang)}
        desc={`${publicHref} · ${page.sections.length} section`}
        action={{ label: t('Tambah section', 'Add section'), icon: 'plus', onClick: () => setPickerOpen(true) }}
      />

      <div className="cms-page-links">
        <Link href="/admin/pages" className="row-act">
          ← {t('Semua halaman', 'All pages')}
        </Link>
        <a
          href={publicHref}
          target="_blank"
          rel="noopener noreferrer"
          className="row-act"
          title={page.status !== 'published' ? t('Masih draf: halaman belum bisa dibuka pengunjung', 'Still a draft: not visible to visitors yet') : undefined}
        >
          {t('Lihat halaman', 'View page')} ↗
        </a>
        <StatusBadge
          label={page.status === 'published' ? t('Terbit', 'Published') : t('Draf', 'Draft')}
          tone={page.status === 'published' ? 'ok' : 'warn'}
          small
        />
        {page.isProtected && <StatusBadge label={t('Halaman bawaan', 'Built-in page')} tone="info" small />}
      </div>

      {page.status !== 'published' && (
        <p className="cms-hint cms-hint-warn">
          {t(
            'Halaman ini masih draf, jadi alamat ',
            'This page is still a draft, so ',
          )}
          <code>{publicHref}</code>
          {t(
            ' dijawab 404 di situs publik. Ubah Status menjadi Terbit pada kartu Pengaturan halaman, lalu klik Simpan pengaturan.',
            ' returns 404 on the public site. Set Status to Published in the Page settings card, then click Save settings.',
          )}
        </p>
      )}

      {!page.isProtected && (
        <p className="cms-hint">
          {t(
            'Halaman buatan sendiri tidak otomatis muncul di menu situs. Tambahkan tautan ',
            'Custom pages are not added to the site menu automatically. Add a link to ',
          )}
          <code>{publicHref}</code>
          {t(' lewat ', ' via ')}
          <Link href="/admin/navigation">{t('Menu Navigasi', 'Navigation')}</Link>
          {t(' agar pengunjung bisa menemukannya.', ' so visitors can find it.')}
        </p>
      )}

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="cms-editor-grid">
        <div>
          <AdminCard
            title={t('Susunan section', 'Sections')}
            desc={t(
              'Urutan di sini adalah urutan tampil di situs. Section tersembunyi tetap tersimpan.',
              'The order here is the display order on the site. Hidden sections are kept.',
            )}
          >
            {page.sections.length === 0 ? (
              <div className="admin-empty">{t('Belum ada section. Klik "Tambah section".', 'No sections yet. Click "Add section".')}</div>
            ) : (
              <div className="cms-section-list">
                {page.sections.map((section, index) => {
                  const def = types?.types[section.type];
                  const summary = summarize(def, section.content, lang);
                  return (
                    <div key={section.id} className={`cms-section-card${section.isVisible ? '' : ' is-hidden'}`}>
                      <div className="cms-section-order">
                        <span>{index + 1}</span>
                      </div>
                      <div className="cms-section-main">
                        <div className="cms-section-title">
                          <strong>{def ? tr(def.name, lang) : section.type}</strong>
                          <code className="mono">{section.type}</code>
                          {section.key && <code className="mono">key: {section.key}</code>}
                        </div>
                        <small className="admin-field-hint">
                          {summary || t('(belum ada isi)', '(no content yet)')}
                          {section.updatedAt ? ` · ${formatDateTime(section.updatedAt, lang)}` : ''}
                        </small>
                      </div>
                      <div className="cms-section-tools">
                        <label className="cms-switch">
                          <input
                            type="checkbox"
                            checked={section.isVisible}
                            disabled={busy !== null}
                            onChange={() => void toggleVisible(section)}
                          />
                          <span>{section.isVisible ? t('Tampil', 'Visible') : t('Sembunyi', 'Hidden')}</span>
                        </label>
                        <button
                          type="button"
                          className="row-act"
                          disabled={busy !== null || index === 0}
                          onClick={() => void move(index, -1)}
                          aria-label={t('Naik', 'Move up')}
                          title={t('Naik', 'Move up')}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="row-act"
                          disabled={busy !== null || index === page.sections.length - 1}
                          onClick={() => void move(index, 1)}
                          aria-label={t('Turun', 'Move down')}
                          title={t('Turun', 'Move down')}
                        >
                          ↓
                        </button>
                        <button type="button" className="row-act" onClick={() => setEditing(section)}>
                          {t('Edit isi', 'Edit content')}
                        </button>
                        <button
                          type="button"
                          className="row-act row-act-danger"
                          disabled={busy !== null}
                          onClick={() => void removeSection(section)}
                        >
                          {t('Hapus', 'Delete')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AdminCard>
        </div>

        <aside>
          <AdminCard title={t('Pengaturan halaman', 'Page settings')}>
            <form className="admin-form" onSubmit={(event) => void saveMeta(event)}>
              {metaError && (
                <p className="form-error" role="alert">
                  {metaError}
                </p>
              )}
              <I18nInput
                label={t('Judul halaman', 'Page title')}
                value={meta.title}
                onChange={(title) => setMeta({ ...meta, title })}
                required
                maxLength={200}
                errorId={firstError(metaErrors, 'title.id', 'title')}
                errorEn={firstError(metaErrors, 'title.en')}
              />
              <label>
                <span className="field-label">Slug</span>
                <input
                  value={meta.slug}
                  disabled={page.isProtected}
                  onChange={(e) => setMeta({ ...meta, slug: e.target.value })}
                  maxLength={128}
                />
                {page.isProtected && (
                  <small className="admin-field-hint">
                    {t('Halaman bawaan; slug tidak bisa diubah.', 'Built-in page; the slug cannot be changed.')}
                  </small>
                )}
                {firstError(metaErrors, 'slug') && <small className="cms-field-error">{firstError(metaErrors, 'slug')}</small>}
              </label>
              <label>
                <span className="field-label">Status</span>
                <Select value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value as PageStatus })}>
                  <option value="draft">{t('Draf', 'Draft')}</option>
                  <option value="published">{t('Terbit', 'Published')}</option>
                </Select>
              </label>
              <I18nInput
                label={t('SEO: judul', 'SEO title')}
                value={meta.seoTitle}
                onChange={(seoTitle) => setMeta({ ...meta, seoTitle })}
                maxLength={200}
                errorId={firstError(metaErrors, 'seo.title.id')}
                errorEn={firstError(metaErrors, 'seo.title.en')}
              />
              <I18nInput
                label={t('SEO: deskripsi', 'SEO description')}
                value={meta.seoDescription}
                onChange={(seoDescription) => setMeta({ ...meta, seoDescription })}
                multiline
                rows={3}
                maxLength={500}
                errorId={firstError(metaErrors, 'seo.description.id')}
                errorEn={firstError(metaErrors, 'seo.description.en')}
              />
              <div>
                <button type="submit" className="btn btn-solid btn-sm" disabled={savingMeta}>
                  {savingMeta ? t('Menyimpan...', 'Saving...') : t('Simpan pengaturan', 'Save settings')}
                </button>
              </div>
            </form>
          </AdminCard>
        </aside>
      </div>

      {editing && (
        <AdminModal
          title={`${t('Edit isi', 'Edit content')}: ${editingDef ? tr(editingDef.name, lang) : editing.type}`}
          onClose={() => setEditing(null)}
          width={920}
        >
          {editingDef && types ? (
            <SectionForm
              section={editing}
              type={editing.type}
              def={editingDef}
              icons={types.icons}
              onSaved={(saved) => {
                replaceSection(saved);
                setEditing(null);
                setNotice(t('Isi section tersimpan.', 'Section content saved.'));
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div className="admin-confirm">
              <p>{t('Tipe section ini tidak dikenal oleh server.', 'This section type is unknown to the server.')}</p>
            </div>
          )}
        </AdminModal>
      )}

      {pickerOpen && (
        <AdminModal title={t('Pilih tipe section', 'Choose a section type')} onClose={() => setPickerOpen(false)} width={980}>
          <div className="cms-type-picker">
            <input
              type="search"
              className="cms-type-search"
              value={typeQuery}
              onChange={(e) => setTypeQuery(e.target.value)}
              placeholder={t('Cari tipe section (mis. foto, FAQ, berita)...', 'Search section types (e.g. photo, FAQ, news)...')}
              aria-label={t('Cari tipe section', 'Search section types')}
              autoFocus
            />
            {typeGroups.length === 0 && <p className="admin-note">{t('Tidak ada tipe yang cocok.', 'No matching type.')}</p>}
            {typeGroups.map((group) => (
              <section key={group.key} className="cms-type-group">
                <h3>
                  {group.label} <span>{group.items.length}</span>
                </h3>
                <div className="cms-type-grid">
                  {group.items.map(([type, def]) => {
                    const suggested = def.pages.includes(page.slug);
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`cms-type-card${suggested ? ' is-suggested' : ''}`}
                        onClick={() => {
                          setPickerOpen(false);
                          setTypeQuery('');
                          setCreating(type);
                        }}
                      >
                        <strong>{tr(def.name, lang)}</strong>
                        <p>{tr(def.description, lang)}</p>
                        {suggested && <span className="cms-type-tag">{t('Disarankan untuk halaman ini', 'Suggested for this page')}</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </AdminModal>
      )}

      {creating && creatingDef && types && (
        <AdminModal
          title={`${t('Tambah section', 'Add section')}: ${tr(creatingDef.name, lang)}`}
          onClose={() => setCreating(null)}
          width={920}
        >
          <SectionForm
            pageId={page.id}
            type={creating}
            def={creatingDef}
            icons={types.icons}
            onSaved={(saved) => {
              setPage((current) => (current ? { ...current, sections: [...current.sections, saved] } : current));
              setCreating(null);
              setNotice(t('Section ditambahkan.', 'Section added.'));
            }}
            onCancel={() => setCreating(null)}
          />
        </AdminModal>
      )}
    </div>
  );
}
