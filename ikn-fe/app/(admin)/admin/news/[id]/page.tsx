'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import { AdminCard, AdminPageHead } from '@/components/admin/AdminPage';
import { I18nInput, I18nRichTextEditor, MediaPicker, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { tr, type PostDetail } from '@/lib/cms';
import { formatDateTime } from '@/lib/format';
import { emptyForm, formFromPost, toLocalInput, toPayload, type NewsForm } from '../newsForm';

// Full-page news editor (WordPress style). `new` creates via POST /admin/news;
// a numeric id loads and saves through GET/PUT /admin/news/{id}.
export default function AdminNewsEditor({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const isNew = params.id === 'new';
  const postId = isNew ? null : Number(params.id);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [form, setForm] = useState<NewsForm>(emptyForm);
  const [snapshot, setSnapshot] = useState<string>(() => JSON.stringify(emptyForm()));
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState<'save' | 'publish' | null>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== snapshot, [form, snapshot]);

  const applyPost = useCallback((detail: PostDetail) => {
    const next = formFromPost(detail);
    setPost(detail);
    setForm(next);
    setSnapshot(JSON.stringify(next));
  }, []);

  useEffect(() => {
    if (isNew) {
      const next = { ...emptyForm(), publishedAt: toLocalInput(new Date().toISOString()) };
      setForm(next);
      setSnapshot(JSON.stringify(next));
      setPost(null);
      setLoading(false);
      return;
    }
    if (postId === null || Number.isNaN(postId)) {
      setError(t('Berita tidak ditemukan.', 'Post not found.'));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api<PostDetail>(`/admin/news/${postId}`)
      .then((detail) => {
        if (!cancelled) applyPost(detail);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `t` only depends on lang; the fetch must not re-run on language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, postId, applyPost]);

  // Warn before the tab closes or reloads with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function save(publish = false) {
    if (saving) return;
    setSaving(publish ? 'publish' : 'save');
    setFormError('');
    setFormErrors({});
    const data = publish ? { ...form, isPublished: true } : form;
    try {
      if (post) {
        const saved = await api<PostDetail>(`/admin/news/${post.id}`, { method: 'PUT', body: toPayload(data) });
        applyPost(saved);
        setNotice(publish ? t('Berita diterbitkan.', 'Post published.') : t('Berita tersimpan.', 'Post saved.'));
      } else {
        const created = await api<PostDetail>('/admin/news', { method: 'POST', body: toPayload(data) });
        applyPost(created);
        router.replace(`/admin/news/${created.id}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormErrors(err.errors);
        setFormError(err.message || t('Periksa kembali isian yang ditandai.', 'Please check the highlighted fields.'));
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSaving(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(false);
  }

  if (loading) {
    return <div className="admin-empty">{t('Memuat berita...', 'Loading post...')}</div>;
  }

  if (!isNew && !post) {
    return (
      <div>
        <AdminPageHead title={t('Berita', 'News')} />
        <p className="form-error">{error || t('Berita tidak ditemukan.', 'Post not found.')}</p>
        <Link href="/admin/news" className="btn btn-line btn-sm">
          {t('Kembali ke daftar', 'Back to list')}
        </Link>
      </div>
    );
  }

  const publicHref = post?.isPublished ? `/berita/${post.slug}` : null;
  const title = post ? tr(post.title, lang) || t('(tanpa judul)', '(untitled)') : t('Tulis berita', 'Write post');
  const busy = saving !== null;

  return (
    <div>
      <AdminPageHead
        title={title}
        desc={
          post
            ? `/berita/${post.slug}${post.updatedAt ? ` · ${t('diubah', 'updated')} ${formatDateTime(post.updatedAt, lang)}` : ''}`
            : t('Berita baru belum tersimpan.', 'This post has not been saved yet.')
        }
      />

      <div className="cms-page-links">
        <Link href="/admin/news" className="row-act">
          ← {t('Kembali ke daftar', 'Back to list')}
        </Link>
        {publicHref && (
          <a href={publicHref} target="_blank" rel="noopener noreferrer" className="row-act">
            {t('Lihat di situs', 'View on site')} ↗
          </a>
        )}
        <StatusBadge
          label={post?.isPublished ? t('Terbit', 'Published') : t('Draf', 'Draft')}
          tone={post?.isPublished ? 'ok' : 'warn'}
          small
        />
        {dirty && <StatusBadge label={t('Belum disimpan', 'Unsaved changes')} tone="info" small />}
      </div>

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <form className="admin-form news-editor-form" onSubmit={submit}>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="news-editor">
          <div className="news-editor-main">
            <AdminCard>
              <div className="cms-fields">
                <I18nInput
                  label={t('Judul', 'Title')}
                  value={form.title}
                  onChange={(value) => setForm({ ...form, title: value })}
                  required
                  maxLength={200}
                  placeholder={t('Judul berita', 'Post title')}
                  errorId={firstError(formErrors, 'title.id', 'title')}
                  errorEn={firstError(formErrors, 'title.en')}
                />
                <I18nInput
                  label={t('Ringkasan (excerpt)', 'Excerpt')}
                  value={form.excerpt}
                  onChange={(value) => setForm({ ...form, excerpt: value })}
                  multiline
                  rows={3}
                  maxLength={1000}
                  placeholder={t('Satu-dua kalimat pembuka untuk daftar berita dan SEO.', 'One or two opening sentences for the list and SEO.')}
                  errorId={firstError(formErrors, 'excerpt.id')}
                  errorEn={firstError(formErrors, 'excerpt.en')}
                />
                <I18nRichTextEditor
                  label={t('Isi berita', 'Body')}
                  value={form.body}
                  onChange={(value) => setForm({ ...form, body: value })}
                  required
                  collection="news"
                  minHeight={460}
                  placeholder={t('Tulis isi berita di sini...', 'Write the article here...')}
                  errorId={firstError(formErrors, 'body.id', 'body')}
                  errorEn={firstError(formErrors, 'body.en')}
                  hint={t(
                    'Gunakan subjudul, daftar, kutipan, gambar, dan video YouTube dari bilah alat. Versi EN kosong akan mengikuti ID.',
                    'Use headings, lists, quotes, images, and YouTube videos from the toolbar. An empty EN version falls back to ID.',
                  )}
                />
              </div>
            </AdminCard>
          </div>

          <aside className="news-editor-side">
            <AdminCard title={t('Publikasi', 'Publish')}>
              <div className="cms-fields">
                <label>
                  <span className="field-label">Status</span>
                  <select value={form.isPublished ? '1' : '0'} onChange={(e) => setForm({ ...form, isPublished: e.target.value === '1' })}>
                    <option value="0">{t('Draf', 'Draft')}</option>
                    <option value="1">{t('Terbit', 'Published')}</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">{t('Tanggal terbit', 'Publish date')}</span>
                  <input type="datetime-local" value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} />
                  {firstError(formErrors, 'publishedAt') && <small className="cms-field-error">{firstError(formErrors, 'publishedAt')}</small>}
                </label>
                <div className="news-editor-actions">
                  <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                    {saving === 'save' ? t('Menyimpan...', 'Saving...') : t('Simpan', 'Save')}
                  </button>
                  {!form.isPublished && (
                    <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => void save(true)}>
                      {saving === 'publish' ? t('Menerbitkan...', 'Publishing...') : t('Simpan & terbitkan', 'Save & publish')}
                    </button>
                  )}
                </div>
                {publicHref && (
                  <a href={publicHref} target="_blank" rel="noopener noreferrer" className="cms-link" style={{ fontSize: '0.84rem' }}>
                    {t('Lihat di situs', 'View on site')} ↗
                  </a>
                )}
              </div>
            </AdminCard>

            <AdminCard title={t('Kategori & penulis', 'Category & author')}>
              <div className="cms-fields">
                <label>
                  <span className="field-label">{t('Kategori / tag', 'Tag')}</span>
                  <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Contoh: Perusahaan" maxLength={64} />
                  {firstError(formErrors, 'tag') && <small className="cms-field-error">{firstError(formErrors, 'tag')}</small>}
                </label>
                <label>
                  <span className="field-label">{t('Penulis', 'Author')}</span>
                  <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Contoh: Humas PT IKN" maxLength={120} />
                  {firstError(formErrors, 'author') && <small className="cms-field-error">{firstError(formErrors, 'author')}</small>}
                </label>
              </div>
            </AdminCard>

            <AdminCard title="Slug">
              <div className="cms-fields">
                <label>
                  <span className="field-label">{t('Alamat (slug)', 'Slug')}</span>
                  <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={t('kosong = otomatis dari judul', 'blank = generated from title')} maxLength={160} />
                  <small className="admin-field-hint">/berita/{form.slug.trim() || (post ? post.slug : t('(otomatis)', '(auto)'))}</small>
                  {firstError(formErrors, 'slug') && <small className="cms-field-error">{firstError(formErrors, 'slug')}</small>}
                </label>
              </div>
            </AdminCard>

            <AdminCard title={t('Gambar sampul', 'Cover image')}>
              <MediaPicker
                value={form.cover}
                onChange={(cover) => setForm({ ...form, cover })}
                accept="image"
                collection="news"
                hint={t('Disarankan rasio 16:9, minimal 1200 px lebar.', 'Recommended 16:9, at least 1200 px wide.')}
                error={firstError(formErrors, 'coverMediaId')}
              />
            </AdminCard>
          </aside>
        </div>
      </form>
    </div>
  );
}
